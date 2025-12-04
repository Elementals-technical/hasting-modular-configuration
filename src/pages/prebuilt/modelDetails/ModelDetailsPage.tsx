import { Link } from "react-router-dom";
import s from "./ModelDetailsPage.module.scss";

export const ModelDetailsPage = () => {
  return (
    <div className={s.modelDetails}>
      <div className={s.detailsDimensions}>
        <div className={s.image}></div>
        <div className={s.dimensions}>
          <div>
            <h4>Dimensions</h4>
            <p>51" Wide</p>
            <p>31" Deep</p>
          </div>

          <div>
            <h4>Cabinet breakdown</h4>

            <ul>
              <li>
                <Link to={""}>
                  <span>A</span>
                  <span>Open Shelf | 35 cm</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className={s.detailsDescription}>
        <div>
          <h4>Cabinet Characteristics</h4>
          <ul>
            <li>Soft-close, ergonomic drawer system</li>
            <li>Metal drawer glide structure</li>
            <li>Dark anthracite internal drawer base finish</li>
            <li>Non-slip, scratch resistant base</li>
            <li>Melamine cabinet structure</li>
            <li>Carb2 compliant materials</li>
          </ul>
        </div>

        <div>
          <h4>Production | Capacity</h4>
          <ul>
            <li>Italian-made, designed and built-to-order</li>
            <li>Eco-conscious production methods</li>
            <li>Max weight capacity 40Kg (88lb per cabinet)</li>
            <li>Rigorous material testing for ease of upkeep</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
