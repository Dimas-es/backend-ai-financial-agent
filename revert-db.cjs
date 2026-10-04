const fs = require('fs');
const files = [
  'src/services/budgetService.ts',
  'src/services/categoryService.ts',
  'src/services/reminderService.ts',
  'src/services/transactionService.ts',
  'src/services/userService.ts',
  'src/wa/bot.ts'
];
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/from '@db/g, "from '../db");
  fs.writeFileSync(file, content);
}
console.log('Replaced imports back to local in backend');
