export function hasVistaarPlusAccess(business: any): boolean {
  const plan = business?.subscription_plan || 'basic';
  const planStr = typeof plan === 'object' && plan?.value ? plan.value : String(plan).toLowerCase();
  const status = business?.subscription_status || 'trial';
  const statusStr = typeof status === 'object' && status?.value ? status.value : String(status).toLowerCase();
  if (statusStr === 'trial') return true;
  return planStr === 'vistaar' || planStr === 'premium' || planStr === 'enterprise';
}
