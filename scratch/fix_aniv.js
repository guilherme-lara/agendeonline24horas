const fs = require('fs');

const path = 'src/pages/dashboard/Aniversarios.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the completely broken message template
content = content.replace(/const msg = encodeURIComponent.*?;/g, 'const msg = encodeURIComponent(`🎁 Parabéns, ${name}! Feliz Aniversário! 🎉 Como presente, você tem 10% de desconto no seu próximo agendamento. Agende já: ${window.location.origin}/${clinic?.slug}`);');

// Replace the broken icon div
content = content.replace(/}">\?\?'<\/div>/g, '}">🎁</div>');

fs.writeFileSync(path, content, 'utf8');
console.log("Fixed Aniversarios");
