import s from "./ModeSwitcher.module.scss";

export const ModeSwitcher = () => {
  return (
    <div className={s.modeSwitcher}>
      <div className={`${s.modeSwitcher_tabItem} ${s.active}`}>
        <div className={s.wrap}>
          <div className={s.title}>Pre-Built Models</div>
          <p className={s.description}>Customize your design from pre-made solutions</p>
        </div>
      </div>
      <div className={s.modeSwitcher_tabItem}>
        <div className={s.wrap}>
          <div className={s.title}>Create Your Own</div>
          <p className={s.description}> Build your own custom, tailored concept</p>
        </div>
      </div>
    </div>
  );
};
