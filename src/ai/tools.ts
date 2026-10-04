export const financialTools = [
  // ──────────────────────────────────────────────
  // TRANSAKSI
  // ──────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: 'add_transaction',
      description:
        'Catat transaksi keuangan baru (pemasukan/income atau pengeluaran/expense). ' +
        'Panggil tool ini setiap kali user menyebutkan bahwa mereka telah mengeluarkan uang atau menerima uang. ' +
        'Jika user menyebut beberapa transaksi dalam satu pesan, panggil tool ini untuk SETIAP transaksi secara terpisah.',
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ['income', 'expense'],
            description: 'Jenis transaksi: "income" untuk pemasukan, "expense" untuk pengeluaran.',
          },
          amount: {
            type: "number",
            description: 'Jumlah uang dalam Rupiah (angka bulat, misal 35000 untuk 35 ribu).',
          },
          description: {
            type: "string",
            description: 'Deskripsi singkat transaksi (misal: "Makan siang", "Gaji bulanan").',
          },
          categoryName: {
            type: "string",
            description:
              'Nama kategori yang sesuai (misal: "Makanan & Minuman", "Transportasi", "Gaji", "Hiburan", "Belanja", "Tagihan"). ' +
              'Tentukan secara cerdas berdasarkan konteks transaksi.',
          },
          date: {
            type: "string",
            description:
              'Waktu transaksi dalam format ISO 8601 (misal: "2026-10-03T12:00:00"). ' +
              'Tentukan berdasarkan pesan user (misal "kemarin", "minggu lalu"). ' +
              'Jika tidak disebutkan, kosongkan parameter ini (akan otomatis pakai hari ini).',
          },
        },
        required: ['type', 'amount', 'description', 'categoryName'],
      },
    },
  },

  {
    type: "function",
    function: {
      name: 'get_monthly_summary',
      description:
        'Mengambil ringkasan keuangan bulanan user: total pemasukan, total pengeluaran, selisih bulan ini (balance), dan saldo dompet saat ini secara keseluruhan (walletBalance). ' +
        'Panggil tool ini ketika user bertanya tentang kondisi keuangan, sisa saldo, saldo dompet, atau rekap bulanan. Jika user bertanya "berapa saldoku", gunakan nilai walletBalance.',
      parameters: {
        type: "object",
        properties: {
          month: {
            type: "number",
            description: 'Bulan yang diminta (1-12). Default: bulan saat ini.',
          },
          year: {
            type: "number",
            description: 'Tahun yang diminta (misal 2026). Default: tahun saat ini.',
          },
        },
        required: ['month', 'year'],
      },
    },
  },

  {
    type: "function",
    function: {
      name: 'get_recent_transactions',
      description:
        'Mengambil daftar transaksi terbaru milik user. ' +
        'Panggil ketika user bertanya tentang riwayat transaksi, pengeluaran terakhir, atau meminta daftar catatan terbaru.',
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: 'Jumlah transaksi yang ingin ditampilkan. Default: 5, maksimum: 10.',
          },
        },
        required: [],
      },
    },
  },

  // ──────────────────────────────────────────────
  // BUDGET / ANGGARAN
  // ──────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: 'set_budget',
      description:
        'Membuat atau memperbarui batas anggaran (budget) bulanan untuk kategori tertentu. ' +
        'Panggil ketika user ingin mengatur budget, misal: "budget makan 500 ribu" atau "limit belanja 1 juta bulan ini".',
      parameters: {
        type: "object",
        properties: {
          categoryName: {
            type: "string",
            description: 'Nama kategori yang ingin di-budget-kan (misal: "Makanan & Minuman").',
          },
          amount: {
            type: "number",
            description: 'Jumlah limit budget dalam Rupiah.',
          },
          month: {
            type: "number",
            description: 'Bulan berlakunya budget (1-12). Default: bulan saat ini.',
          },
          year: {
            type: "number",
            description: 'Tahun berlakunya budget. Default: tahun saat ini.',
          },
        },
        required: ['categoryName', 'amount', 'month', 'year'],
      },
    },
  },

  {
    type: "function",
    function: {
      name: 'check_budget',
      description:
        'Mengecek status pemakaian budget untuk kategori tertentu pada bulan ini. ' +
        'Mengembalikan berapa yang sudah terpakai, sisa, dan persentase pemakaian. ' +
        'Panggil ketika user bertanya tentang sisa budget atau status anggaran.',
      parameters: {
        type: "object",
        properties: {
          categoryName: {
            type: "string",
            description: 'Nama kategori yang ingin dicek budget-nya.',
          },
          month: {
            type: "number",
            description: 'Bulan yang ingin dicek (1-12). Default: bulan saat ini.',
          },
          year: {
            type: "number",
            description: 'Tahun yang ingin dicek. Default: tahun saat ini.',
          },
        },
        required: ['categoryName', 'month', 'year'],
      },
    },
  },

  // ──────────────────────────────────────────────
  // PENGINGAT / REMINDER
  // ──────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: 'create_reminder',
      description:
        'Membuat pengingat keuangan baru. ' +
        'Panggil ketika user meminta diingatkan untuk sesuatu terkait keuangan, ' +
        'misal: "ingatkan bayar listrik tanggal 20" atau "reminder bayar wifi minggu depan".',
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: 'Pesan pengingat yang akan dikirimkan (misal: "Bayar tagihan listrik PLN").',
          },
          scheduledAt: {
            type: "string",
            description:
              'Waktu pengingat dalam format ISO 8601 (misal: "2026-10-20T08:00:00"). ' +
              'Tentukan tanggal dan waktu berdasarkan konteks pesan user. ' +
              'Jika user hanya menyebut tanggal tanpa jam, default ke pukul 08:00 pagi.',
          },
          isRecurring: {
            type: "boolean",
            description: 'Apakah pengingat ini berulang setiap bulan. Default: false.',
          },
        },
        required: ['message', 'scheduledAt'],
      },
    },
  },

  {
    type: "function",
    function: {
      name: 'get_pending_reminders',
      description:
        'Mengambil daftar semua pengingat yang masih aktif (belum terkirim). ' +
        'Panggil ketika user bertanya tentang daftar pengingat atau jadwal yang sudah dibuat.',
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];
