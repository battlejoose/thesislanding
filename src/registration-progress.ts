export type RegistrationStage = 'check' | 'payment' | 'sync' | 'swaps' | 'live';

/** Read-only view of the durable registration journal; never advances by elapsed time. */
export function registrationStage(job: {
  status: string; table?: string;
  sent: readonly {label: string; state: string}[];
}): RegistrationStage {
  if (job.status === 'ready' || job.sent.some(s => s.label === 'surplus')) return 'live';
  if (job.sent.find(s => s.label === 'register')?.state !== 'confirmed') return 'payment';
  return job.table ? 'swaps' : 'sync';
}

export const registrationSteps: {stage: RegistrationStage; label: string; detail: string}[] = [
  {stage:'check',label:'Check token',detail:'Checking the token and preparing your payment.'},
  {stage:'payment',label:'Confirm payment',detail:'Waiting for your registration payment to finalize on Solana.'},
  {stage:'sync',label:'Connect live trading',detail:'Waiting for the token’s trading accounts to synchronize.'},
  {stage:'swaps',label:'Prepare token swaps',detail:'Preparing and confirming the token’s swap setup.'},
  {stage:'live',label:'Enable trading',detail:'Finishing setup and adding the token to the app.'},
];
