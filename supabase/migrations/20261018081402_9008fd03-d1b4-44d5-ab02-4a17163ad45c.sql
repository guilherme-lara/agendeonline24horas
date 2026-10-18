DROP FUNCTION IF EXISTS public.checkout_pdv(uuid,jsonb,jsonb,uuid,text,uuid,uuid,boolean);
CREATE OR REPLACE FUNCTION public.checkout_pdv(_shop uuid, _items jsonb, _payments jsonb, _customer uuid DEFAULT NULL, _client_name text DEFAULT 'Cliente Balcão', _sale uuid DEFAULT NULL, _appointment uuid DEFAULT NULL, _complete boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _manager boolean; _reg uuid; _sale_id uuid; _a public.appointments%ROWTYPE; _i jsonb; _p jsonb; _id uuid; _ids uuid[] := '{}'; _total numeric := 0; _deposit numeric := 0; _already numeric; _amount numeric := 0; _linked numeric; _method text; _items_actual jsonb := _items; _gross numeric; _qty integer; _price numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Login necessário' USING ERRCODE='42501'; END IF;
  _manager := public.has_role(_uid,'admin') OR EXISTS(SELECT 1 FROM public.barbershops WHERE id=_shop AND owner_id=_uid);
  IF NOT _manager AND NOT EXISTS(SELECT 1 FROM public.barbers WHERE barbershop_id=_shop AND user_id=_uid AND active) THEN RAISE EXCEPTION 'Sem acesso à clínica' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_shop::text,0));
  IF _customer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.customers WHERE id=_customer AND barbershop_id=_shop) THEN RAISE EXCEPTION 'Cliente inválido'; END IF;
  IF _sale IS NOT NULL THEN
    PERFORM 1 FROM public.sales WHERE id=_sale AND barbershop_id=_shop AND status='open' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Venda já fechada ou indisponível'; END IF;
  END IF;
  IF _appointment IS NOT NULL THEN
    SELECT * INTO _a FROM public.appointments WHERE id=_appointment AND barbershop_id=_shop FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Comanda indisponível'; END IF;
    _items_actual := jsonb_build_array(jsonb_build_object('source_appointment_id',_a.id,'item_id',_a.id,'item_type','service','name',_a.service_name,'quantity',1,'unit_price',COALESCE(_a.total_price,_a.price),'total_price',COALESCE(_a.total_price,_a.price)));
  END IF;
  IF _items_actual IS NULL OR jsonb_typeof(_items_actual)<>'array' OR jsonb_array_length(_items_actual)=0 THEN RAISE EXCEPTION 'Comanda vazia'; END IF;
  IF _payments IS NULL OR jsonb_typeof(_payments)<>'array' THEN RAISE EXCEPTION 'Pagamentos inválidos'; END IF;
  FOR _i IN SELECT value FROM jsonb_array_elements(_items_actual) LOOP
    _qty := (_i->>'quantity')::integer; _price := (_i->>'unit_price')::numeric;
    IF _qty IS NULL OR _qty<1 OR _price IS NULL OR _price<0 OR (_i->>'item_type') NOT IN ('product','service') OR round((_i->>'total_price')::numeric,2) IS DISTINCT FROM round(_qty*_price,2) THEN RAISE EXCEPTION 'Item inválido'; END IF;
    _total := _total + round(_qty*_price,2);
    _id := NULLIF(_i->>'source_appointment_id','')::uuid;
    IF _id IS NOT NULL AND NOT (_id=ANY(_ids)) THEN _ids := array_append(_ids,_id); END IF;
    IF _id IS NULL AND _i->>'item_type'='service' AND NOT _manager AND NOT EXISTS(SELECT 1 FROM public.barbers WHERE id=NULLIF(_i->>'barber_id','')::uuid AND barbershop_id=_shop AND user_id=_uid AND active) THEN RAISE EXCEPTION 'Selecione seu profissional responsável' USING ERRCODE='42501'; END IF;
    IF _id IS NULL AND NULLIF(_i->>'barber_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.barbers WHERE id=(_i->>'barber_id')::uuid AND barbershop_id=_shop AND active) THEN RAISE EXCEPTION 'Profissional inválido'; END IF;
  END LOOP;
  FOR _id IN SELECT unnest(_ids) ORDER BY 1 LOOP
    SELECT * INTO _a FROM public.appointments WHERE id=_id AND barbershop_id=_shop FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Comanda indisponível'; END IF;
    IF NOT _manager AND NOT EXISTS(SELECT 1 FROM public.barbers WHERE user_id=_uid AND barbershop_id=_shop AND (id=_a.barber_id OR (_a.barber_id IS NULL AND name=_a.barber_name))) THEN RAISE EXCEPTION 'Você só pode fechar suas comandas' USING ERRCODE='42501'; END IF;
    IF _a.status='cancelled' OR (_a.status='completed' AND _a.payment_status='paid') THEN RAISE EXCEPTION 'Comanda cancelada ou já paga'; END IF;
    _gross := COALESCE(_a.total_price,_a.price,0);
    SELECT COALESCE(sum((value->>'total_price')::numeric),0) INTO _linked FROM jsonb_array_elements(_items_actual) WHERE value->>'source_appointment_id'=_id::text;
    IF round(_linked,2)<>round(_gross,2) THEN RAISE EXCEPTION 'Os itens da comanda mudaram. Atualize e selecione a comanda completa'; END IF;
    SELECT COALESCE(sum(amount),0) INTO _already FROM public.appointment_payments WHERE appointment_id=_id AND status='confirmed';
    _deposit := _deposit + LEAST(_gross,GREATEST(_already,COALESCE(_a.advance_payment_amount,0),CASE WHEN _a.has_signal THEN COALESCE(_a.signal_value,0) ELSE 0 END));
  END LOOP;
  FOR _p IN SELECT value FROM jsonb_array_elements(_payments) LOOP
    _method := _p->>'method';
    IF _method NOT IN ('pix','credit_card','debit_card','cash','transfer','other') OR (_p->>'amount')::numeric IS NULL OR (_p->>'amount')::numeric<=0 OR COALESCE((_p->>'installments')::integer,1) NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'Pagamento inválido'; END IF;
    _amount := _amount + round((_p->>'amount')::numeric,2);
  END LOOP;
  IF round(_amount,2)<>round(GREATEST(_total-_deposit,0),2) THEN RAISE EXCEPTION 'Valor recebido não corresponde ao saldo da comanda. Atualize os pagamentos'; END IF;
  SELECT id INTO _reg FROM public.cash_registers WHERE barbershop_id=_shop AND status='open' FOR UPDATE;
  IF _reg IS NULL THEN INSERT INTO public.cash_registers(barbershop_id,opened_by,initial_balance,status,notes) VALUES(_shop,_uid,0,'open','Caixa aberto no fechamento de comanda') RETURNING id INTO _reg; END IF;
  IF _sale IS NULL THEN INSERT INTO public.sales(barbershop_id,customer_id,total_amount,status,created_by) VALUES(_shop,_customer,_total,'paid',_uid) RETURNING id INTO _sale_id;
  ELSE _sale_id:=_sale; UPDATE public.sales SET total_amount=_total,status='paid',customer_id=_customer WHERE id=_sale_id; DELETE FROM public.sales_items WHERE sale_id=_sale_id; END IF;
  FOR _i IN SELECT value FROM jsonb_array_elements(_items_actual) LOOP
    INSERT INTO public.sales_items(sale_id,item_type,item_id,name,quantity,unit_price,total_price) VALUES(_sale_id,_i->>'item_type',COALESCE(NULLIF(_i->>'item_id','')::uuid,gen_random_uuid()),_i->>'name',(_i->>'quantity')::integer,(_i->>'unit_price')::numeric,(_i->>'total_price')::numeric);
    IF NULLIF(_i->>'source_appointment_id','') IS NULL AND _i->>'item_type'='service' THEN
      INSERT INTO public.appointments(barbershop_id,client_name,customer_id,service_name,barber_id,barber_name,price,total_price,scheduled_at,status,payment_status,payment_method,payment_confirmed_at)
      VALUES(_shop,COALESCE(_client_name,'Cliente Balcão'),_customer,_i->>'name',NULLIF(_i->>'barber_id','')::uuid,_i->>'barber_name',(_i->>'total_price')::numeric,(_i->>'total_price')::numeric,now(),'completed','paid',COALESCE(_payments->0->>'method','local'),now()) RETURNING id INTO _id;
      _ids := array_append(_ids,_id);
    END IF;
  END LOOP;
  FOR _p IN SELECT value FROM jsonb_array_elements(_payments) LOOP
    INSERT INTO public.cash_movements(register_id,barbershop_id,movement_type,amount,payment_method,appointment_id,origin_type,origin_id,created_by,description)
    VALUES(_reg,_shop,'sale',round((_p->>'amount')::numeric,2),_p->>'method',CASE WHEN cardinality(_ids)=1 THEN _ids[1] ELSE NULL END,'sale',_sale_id,_uid,'Fechamento PDV '||_sale_id::text);
    IF cardinality(_ids)=1 THEN
      INSERT INTO public.appointment_payments(appointment_id,barbershop_id,amount,payment_method,installments,status,register_id,created_by)
      VALUES(_ids[1],_shop,round((_p->>'amount')::numeric,2),_p->>'method',COALESCE((_p->>'installments')::integer,1),'confirmed',_reg,_uid);
    END IF;
  END LOOP;
  UPDATE public.appointments SET status=CASE WHEN _complete THEN 'completed' ELSE status END,payment_status='paid',payment_method=CASE WHEN jsonb_array_length(_payments)>1 THEN 'split' ELSE COALESCE(_payments->0->>'method','local') END,payment_confirmed_at=now() WHERE id=ANY(_ids);
  RETURN _sale_id;
END $$;
REVOKE ALL ON FUNCTION public.checkout_pdv(uuid,jsonb,jsonb,uuid,text,uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.checkout_pdv(uuid,jsonb,jsonb,uuid,text,uuid,uuid,boolean) TO authenticated,service_role;

DROP FUNCTION IF EXISTS public.approve_appointment_commission(uuid);
CREATE OR REPLACE FUNCTION public.approve_appointment_commission(_appointment_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _a public.appointments%ROWTYPE;
BEGIN
  SELECT * INTO _a FROM public.appointments WHERE id=_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.barbershops WHERE id=_a.barbershop_id AND owner_id=auth.uid())) THEN RAISE EXCEPTION 'Sem permissão para liberar comissão' USING ERRCODE='42501'; END IF;
  IF _a.status<>'completed' OR _a.payment_status IS DISTINCT FROM 'paid' OR _a.commission_amount IS NULL THEN RAISE EXCEPTION 'A comanda deve estar concluída, paga e com comissão registrada'; END IF;
  IF _a.commission_approved THEN RETURN; END IF;
  UPDATE public.appointments SET commission_approved=true,commission_approved_at=now(),commission_approved_by=auth.uid() WHERE id=_appointment_id;
END $$;
REVOKE ALL ON FUNCTION public.approve_appointment_commission(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_appointment_commission(uuid) TO authenticated,service_role;
DROP TRIGGER IF EXISTS trg_notify_appointments ON public.appointments;