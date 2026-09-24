import sys
import os

file_path = 'src/pages/PublicBooking.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

replacements = {
    'negÃ³cio': 'negócio',
    'sÃ³': 'só',
    'horÃ¡rio': 'horário',
    'Brasâ”œÂ¡lia': 'Brasília',
    'Criaâ”œÂºâ”œÃºo': 'Criação',
    'serviâ”œÂºos': 'serviços',
    'horâ”œÃ­rio': 'horário',
    'indisponâ”œÂ¡vel': 'indisponível',
    'vÃ¡lido': 'válido',
    'Nâ”œÃºo': 'Não',
    'Ã”Ã‡Ã¶': '-',
    'Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡Ã”Ã¶Ã‡': '-----------------------------------------------------------',
    'jâ”œÃ­': 'já',
    'Serviâ”œÂºo': 'Serviço',
    'EndereÃ§o': 'Endereço',
}

for k, v in replacements.items():
    text = text.replace(k, v)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Done")
