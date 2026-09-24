const fs = require('fs');

const filePath = 'src/pages/PublicBooking.tsx';
let text = fs.readFileSync(filePath, 'utf8');

const replacements = {
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
};

for (const [k, v] of Object.entries(replacements)) {
    text = text.split(k).join(v);
}

fs.writeFileSync(filePath, text, 'utf8');
console.log("Done");
