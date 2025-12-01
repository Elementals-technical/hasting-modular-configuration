import s from "./StepStub.module.scss";

type StepStubProps = {
  flow: "Prebuilt" | "Custom";
  step: string;
};

export const StepStub = ({ flow, step }: StepStubProps) => {
  return (
    <div className={s.stub}>
      <div className={s.label}>{flow}</div>
      <h2 className={s.title}>{step}</h2>
      <p className={s.helper}>step UI</p>
    </div>
  );
};
