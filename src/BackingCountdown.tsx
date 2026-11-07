export function BackingCountdown({seconds}:{seconds:number}) {
  return <small className="backing-countdown" title="Displayed estimates refresh every 10 seconds. Trading uses live prices.">{seconds>0?`Updating in ${seconds}s`:'Updating…'}</small>;
}
