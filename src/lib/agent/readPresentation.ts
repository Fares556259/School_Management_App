/** UI metadata is derived from the tool result, never from generated text. */
export function buildReadPresentation(name: string, args: Record<string, any>, output: any, scope: { schoolId: string; schoolName?: string }, toolCallId: string) {
  if (!output || output.error || output.success === false) return { evidence: null, widget: null };
  if (output.scopeSchoolId && output.scopeSchoolId !== scope.schoolId) return { evidence: null, widget: null };
  if (name === 'search_school_knowledge') return {
    evidence: { source: 'school_knowledge', schoolId: scope.schoolId, schoolName: scope.schoolName, toolCallId, fetchedAt: output.fetchedAt, sources: output.sources || [], total: output.count || 0, verified: false, filters: { query: args.query || '' } as Record<string, string | number>, returned: output.sources?.length || 0, hasMore: false }, widget: null,
  };
  const rows = Array.isArray(output.students) ? output.students : Array.isArray(output.records) ? output.records : null;
  const total = [output.total, output.count, output.summary?.selectedCount, output.summary?.filteredPeriodCount, name === 'get_payments' ? rows?.length : undefined, output.unpaidCount].find(value => Number.isInteger(value) && value >= 0);
  const filters: Record<string, string | number> = {};
  const merged = { ...args, ...(output.filters || {}), ...(output.month ? { month: output.month } : {}), ...(output.year ? { year: output.year } : {}), ...(output.date ? { date: output.date } : {}) };
  for (const key of ['className', 'query', 'month', 'year', 'date', 'status', 'studentName', 'category']) {
    if (typeof merged[key] === 'string' || typeof merged[key] === 'number') filters[key] = merged[key];
  }
  if (output.period || output.periodFrench) filters.period = String(output.periodFrench || output.period);
  const evidence = { source: 'school_database', fetchedAt: output.fetchedAt, schoolId: scope.schoolId, schoolName: scope.schoolName, toolCallId, filters, total: total ?? null, returned: rows?.length ?? null, hasMore: output.hasMore === true, verified: true, sources: [] };
  if (name === 'get_daily_caisse' && output.summary) {
    const amount = (value: any) => Number.parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;
    return { evidence, widget: { type: 'caisse' as const, data: { date: output.date, totalIncomes: amount(output.summary.totalIncomes), totalExpenses: amount(output.summary.totalExpenses), netCashBalance: amount(output.summary.netCashBalance), paymentsCount: output.summary.paymentsCount, expensesCount: output.summary.expensesCount } } };
  }
  if (name === 'get_financial_summary') return { evidence, widget: { type: 'finance_summary' as const, data: { period: output.periodFrench || output.period, totalRevenue: output.totalIncome, totalExpenses: output.totalExpense, netProfit: output.netProfit, unpaidTuition: output.unpaidTuition, unpaidStudentsCount: output.unpaidStudentsCount } } };
  if (!['get_students', 'get_payments', 'get_incomes', 'get_expenses'].includes(name) || !rows) return { evidence, widget: null };
  return { evidence, widget: { type: 'school_records' as const, data: {
    title: args.className ? `Classe ${args.className}` : ({ get_payments: 'Paiements', get_incomes: 'Recettes', get_expenses: 'Dépenses' } as any)[name] || 'Élèves', kind: name, total: total ?? rows.length, offset: output.offset || 0,
    rows: rows.map((student: any, index: number) => ({ key: String(index), title: student.fullName || student.studentName || student.title, subtitle: student.class || student.category, detail: student.parent ? String(student.parent).replace(/\(([^)]+)\)/g, (_match, phone) => `(${String(phone).slice(0, 2)}••••${String(phone).slice(-2)})`) : student.parentName || student.date || null, amount: name === 'get_payments' ? student.dueAmount : student.amount })),
    className: args.className || null, classId: output.classId || null, hasMore: output.hasMore === true,
  } } };
}
