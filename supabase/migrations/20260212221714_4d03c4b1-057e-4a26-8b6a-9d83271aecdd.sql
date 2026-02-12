UPDATE public.barbershops 
SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{abacate_pay_api_key}', '"abc_dev_PAFSpUJA4mmdNJZgqXCCZc1T"')
WHERE id = '9f8fc4f8-b209-4012-a7e9-594f01af29bc';