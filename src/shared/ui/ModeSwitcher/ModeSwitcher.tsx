import s from "./ModeSwitcher.module.scss";

interface ModeSwitcherI {
  onClick: () => void;
}

export const ModeSwitcher: React.FC<ModeSwitcherI> = ({ onClick }) => {
  return (
    <div className={s.modeSwitcher}>
      <div className={`${s.modeSwitcher_tabItem} ${s.active}`}>
        <div className={s.wrap}>
          <div className={s.title}>Pre-Built Models</div>
          <p className={s.description}>Customize your design from pre-made solutions</p>
        </div>
      </div>
      <div className={s.modeSwitcher_tabItem} onClick={onClick}>
        <div className={s.wrap}>
          <div className={s.title}>Create Your Own</div>
          <p className={s.description}> Build your own custom, tailored concept</p>
        </div>
      </div>
    </div>
  );
};
