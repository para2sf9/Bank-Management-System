import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Account from './models/Account.js';
import LedgerEntry from './models/LedgerEntry.js';

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/northstar_demo?replicaSet=rs0');
try {
  const email = 'demo@northstar.test';
  const passwordHash = await bcrypt.hash('DemoPass123!', 12);
  const user = await User.findOneAndUpdate({ email }, { $set: { name: 'Jordan Morgan', passwordHash, status: 'active' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  let checking = await Account.findOne({ ownerId: user._id, label: 'Everyday checking' });
  let savings = await Account.findOne({ ownerId: user._id, label: 'Growth savings' });
  if (!checking) checking = await Account.create({ ownerId: user._id, label: 'Everyday checking', type: 'checking', balanceMinor: 482650, accountLast4: '2841' });
  if (!savings) savings = await Account.create({ ownerId: user._id, label: 'Growth savings', type: 'savings', balanceMinor: 725000, accountLast4: '9076' });
  const count = await LedgerEntry.countDocuments({ ownerId: user._id });
  if (!count) {
    const now = Date.now();
    const rows = [
      { accountId: checking._id, type: 'opening', amountMinor: checking.balanceMinor, description: 'Welcome balance', accountLast4: checking.accountLast4, days: 16 },
      { accountId: savings._id, type: 'opening', amountMinor: savings.balanceMinor, description: 'Savings balance', accountLast4: savings.accountLast4, days: 15 },
      { accountId: checking._id, type: 'debit', amountMinor: 4280, description: 'Coffee & Co.', accountLast4: checking.accountLast4, days: 1 },
      { accountId: checking._id, type: 'credit', amountMinor: 185000, description: 'Monthly paycheck', accountLast4: checking.accountLast4, days: 2 },
      { accountId: checking._id, type: 'debit', amountMinor: 12650, description: 'Market Street Grocer', accountLast4: checking.accountLast4, days: 3 },
      { accountId: savings._id, type: 'credit', amountMinor: 25000, description: 'Monthly savings', accountLast4: savings.accountLast4, days: 5 },
      { accountId: checking._id, type: 'debit', amountMinor: 6499, description: 'Streaming subscription', accountLast4: checking.accountLast4, days: 7 },
      { accountId: checking._id, type: 'debit', amountMinor: 3920, description: 'City transit', accountLast4: checking.accountLast4, days: 9 },
      { accountId: savings._id, type: 'credit', amountMinor: 4100, description: 'Savings interest', accountLast4: savings.accountLast4, days: 12 }
    ];
    const balances = new Map([[checking._id.toString(), checking.balanceMinor], [savings._id.toString(), savings.balanceMinor]]);
    const entries = rows.map(row => {
      if (row.type === 'debit') balances.set(row.accountId.toString(), balances.get(row.accountId.toString()) + row.amountMinor);
      if (row.type === 'credit') balances.set(row.accountId.toString(), balances.get(row.accountId.toString()) - row.amountMinor);
      const balance = balances.get(row.accountId.toString());
      return { ownerId: user._id, accountId: row.accountId, entryType: row.type, amountMinor: row.amountMinor, balanceAfterMinor: balance, description: row.description, accountLast4: row.accountLast4, createdAt: new Date(now - row.days * 86400000) };
    });
    await LedgerEntry.insertMany(entries);
  }
  console.log('Demo account ready: demo@northstar.test / DemoPass123!');
} finally { await mongoose.disconnect(); }
