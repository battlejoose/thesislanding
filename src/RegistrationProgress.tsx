import {registrationSteps, type RegistrationStage} from './registration-progress.ts';

export function RegistrationProgress({stage, message}: {stage: RegistrationStage; message?: string}) {
  const current = registrationSteps.findIndex(step => step.stage === stage);
  return <section className="registration-working" aria-busy="true" aria-label="Token registration progress">
    <div className="registration-working-heading"><span className="registration-spinner" aria-hidden="true"/><div>
      <strong>Setting up your token</strong><small role="status" aria-live="polite">{message || registrationSteps[current].detail}</small>
    </div></div>
    <ol>{registrationSteps.map((step,index)=><li key={step.stage} className={index < current ? 'done' : index === current ? 'current' : ''} aria-current={index === current ? 'step' : undefined}>
      <span aria-hidden="true">{index < current ? '✓' : index + 1}</span>{step.label}
    </li>)}</ol>
    <small className="registration-working-note">Keep this window open. Setup can take a few minutes.<br/>The registration fee is charged only once.</small>
  </section>;
}
