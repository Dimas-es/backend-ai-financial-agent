import 'dotenv/config';
import {
  getOrCreateUser,
  getOrCreateCategory,
  getUserCategories,
  addTransaction,
  getMonthlySummary,
  getRecentTransactions,
  upsertBudget,
  checkBudgetStatus,
  createReminder,
  getUserPendingReminders,
} from '../src/services';

async function runTests() {
  console.log('==================================================');
  console.log('🧪 Memulai Pengujian Modul Servis Keuangan (Fase 3)');
  console.log('==================================================\n');

  try {
    // 1. Uji User Service
    console.log('▶ [1/5] Pengujian User Service...');
    const testPhone = '6289999999999';
    const user = await getOrCreateUser(testPhone, 'Testing User');
    console.log(`✅ User berhasil diinisialisasi: ID=${user.id}, Name=${user.name}\n`);

    // 2. Uji Category Service
    console.log('▶ [2/5] Pengujian Category Service...');
    const catExpense = await getOrCreateCategory(user.id, 'Makanan & Minuman', 'expense');
    const catIncome = await getOrCreateCategory(user.id, 'Gaji Pokok', 'income');
    const categoriesList = await getUserCategories(user.id);
    console.log(`✅ Kategori berhasil: Ditemukan ${categoriesList.length} kategori user.`);
    console.log(`   - Expense: ${catExpense.name} (ID: ${catExpense.id})`);
    console.log(`   - Income: ${catIncome.name} (ID: ${catIncome.id})\n`);

    // 3. Uji Transaction Service
    console.log('▶ [3/5] Pengujian Transaction Service...');
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Catat pemasukan
    const txIncome = await addTransaction({
      userId: user.id,
      type: 'income',
      amount: 10000000,
      description: 'Gaji Bulanan Oktober',
      categoryName: 'Gaji Pokok',
    });
    console.log(`   + Pemasukan dicatat: Rp ${txIncome.amount.toLocaleString()} - ${txIncome.description}`);

    // Catat pengeluaran 1
    const txExpense1 = await addTransaction({
      userId: user.id,
      type: 'expense',
      amount: 50000,
      description: 'Makan Nasi Padang',
      categoryName: 'Makanan & Minuman',
    });
    console.log(`   - Pengeluaran dicatat: Rp ${txExpense1.amount.toLocaleString()} - ${txExpense1.description}`);

    // Catat pengeluaran 2
    const txExpense2 = await addTransaction({
      userId: user.id,
      type: 'expense',
      amount: 35000,
      description: 'Kopi Susu Senja',
      categoryName: 'Makanan & Minuman',
    });
    console.log(`   - Pengeluaran dicatat: Rp ${txExpense2.amount.toLocaleString()} - ${txExpense2.description}`);

    // Rekap bulanan
    const summary = await getMonthlySummary(user.id, currentMonth, currentYear);
    console.log(`✅ Rekap Bulanan (${currentMonth}/${currentYear}):`);
    console.log(`   • Total Pemasukan : Rp ${summary.totalIncome.toLocaleString()}`);
    console.log(`   • Total Pengeluaran: Rp ${summary.totalExpense.toLocaleString()}`);
    console.log(`   • Saldo Bersih    : Rp ${summary.balance.toLocaleString()}`);
    console.log(`   • Jumlah Transaksi : ${summary.transactionCount}`);

    // Riwayat transaksi
    const recent = await getRecentTransactions(user.id, 3);
    console.log(`✅ 3 Transaksi Terakhir berhasil diambil (total item: ${recent.length})\n`);

    // 4. Uji Budget Service
    console.log('▶ [4/5] Pengujian Budget Service...');
    const budget = await upsertBudget(
      user.id,
      'Makanan & Minuman',
      500000, // Budget 500rb
      currentMonth,
      currentYear,
      80 // Alert threshold 80%
    );
    console.log(`✅ Anggaran diset: Rp ${parseFloat(budget.amount).toLocaleString()} untuk "${budget.categoryName}"`);

    const budgetStatus = await checkBudgetStatus(user.id, 'Makanan & Minuman', currentMonth, currentYear);
    if (budgetStatus) {
      console.log(`✅ Status Anggaran "${budgetStatus.categoryName}":`);
      console.log(`   • Terpakai: Rp ${budgetStatus.spent.toLocaleString()} / Rp ${budgetStatus.budgetAmount.toLocaleString()} (${budgetStatus.percentageUsed}%)`);
      console.log(`   • Sisa     : Rp ${budgetStatus.remaining.toLocaleString()}`);
      console.log(`   • Alert?   : ${budgetStatus.isAlertTriggered ? 'YA ⚠️' : 'AMAN ✅'}\n`);
    }

    // 5. Uji Reminder Service
    console.log('▶ [5/5] Pengujian Reminder Service...');
    const scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Besok
    const reminder = await createReminder(
      user.id,
      'Bayar tagihan listrik PLN',
      scheduledTime
    );
    console.log(`✅ Pengingat dibuat: ID #${reminder.id} - "${reminder.message}" pada ${reminder.scheduledAt.toLocaleString()}`);

    const pendingReminders = await getUserPendingReminders(user.id);
    console.log(`✅ Total pengingat pending untuk user: ${pendingReminders.length}\n`);

    console.log('==================================================');
    console.log('🎉 SEMUA PENGUJIAN SERVIS FASE 3 BERHASIL 100%!');
    console.log('==================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Terjadi kesalahan pada saat pengujian:', error);
    process.exit(1);
  }
}

runTests();
