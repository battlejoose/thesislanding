import './page-motion.css';

/** CSS effects need the same hidden-tab lifecycle as our canvas workers. */
export function installPageMotion() {
  const update = () => {
    document.documentElement.dataset.pageHidden = String(document.hidden);
  };
  document.addEventListener('visibilitychange', update);
  update();
  return () => {
    document.removeEventListener('visibilitychange', update);
    delete document.documentElement.dataset.pageHidden;
  };
}
