

# Finalização Tecnica e QA - TechBarber

## 1. Remoção do QR Code e Redesign do Modal Pix

**Problema**: A imagem do QR Code está prejudicando o layout mobile e causando distorções visuais.

**Solução**: Remover completamente o bloco de QR Code do `PixPaymentModal.tsx` e focar exclusivamente no campo "Pix Copia e Cola" com design minimalista.

### Alterações em `src/components/PixPaymentModal.tsx`:
- Remover o container de QR Code (linhas 134-149) e o import de `QrCode`
- Remover a prop `pixQrCodeImage` da interface (limpeza)
- Manter o campo "Pix Copia e Cola" com container de largura fixa, texto truncado (ellipsis) e botao "Copiar" gold-gradient
- Atualizar o `DialogDescription` de "Escaneie o QR Code ou copie..." para "Copie o codigo Pix abaixo"
- Remover o botao "Abrir link de pagamento" (simplificar)
- Manter: Realtime + polling fallback, animação de sucesso, auto-close

---

## 2. Footer Global com Branding

**Solução**: Criar um componente `Footer.tsx` e adicioná-lo ao `App.tsx` abaixo das Routes.

### Novo arquivo `src/components/Footer.tsx`:
- Texto: "Desenvolvido por Guilherme Lara - Jotatechinfo - Copyright (c) 2026"
- Estilo: `border-t border-border bg-background text-muted-foreground text-xs text-center py-4`
- Discreto, alinhado ao tema Dark/Dourado

### Alteração em `src/App.tsx`:
- Importar e adicionar `<Footer />` após o `</Routes>`

---

## 3. Robustez e Tratamento de Erros

### Edge Function `create-pix-charge`:
- Melhorar logs de erro para serem descritivos (já está bom, apenas ajustar mensagens)
- Garantir que erros da API AbacatePay retornem detalhes legíveis no console

### Edge Function `abacatepay-webhook`:
- Já está robusto com 3 estratégias de busca - sem alterações necessárias

### Frontend (`PublicBooking.tsx`):
- O fluxo de fallback (Retry/Pagar na Barbearia) já existe - sem alterações
- Remover a prop `pixQrCodeImage` da chamada ao `PixPaymentModal`

---

## 4. Limpeza de Props Obsoletas

Como o QR Code será removido, limpar referências em:
- `PublicBooking.tsx`: remover `pixQrCodeImage` do estado `pixData` e da passagem de props
- `PixPaymentModal.tsx`: remover `pixQrCodeImage` da interface

---

## Secao Tecnica - Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/PixPaymentModal.tsx` | Remover QR Code, limpar props, ajustar texto |
| `src/components/Footer.tsx` | Criar novo componente de footer |
| `src/App.tsx` | Adicionar Footer global |
| `src/pages/PublicBooking.tsx` | Remover `pixQrCodeImage` do estado/props |

Nenhuma alteração de banco de dados ou edge functions é necessária. A lógica de Realtime, polling e webhook já está funcional.

