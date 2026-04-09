import { useEffect, useMemo } from "react";

import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { faucetHolesAmountData } from "./constants";
import type { AccordionConfig } from "@/shared/constants/types";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getFaucetHolesAmount,
  getSelectedDimensions,
  getSelectedProducts,
  getSinkType,
} from "@/entities/product/model/store/selectors";
import { useSinkBaseDimensions } from "@/shared/hooks/useSinkBaseDimensions";
import { setFaucetHolesAmount } from "@/entities/product/model/store/slice";
import { useGetCountertopDatatableQuery } from "@/entities/countertop";
import {
  buildCountertopRuleState,
  normalizeFaucetHoleToken,
  parseCountertopMatrix,
} from "@/features/configurator-rule-core/countertop";
import { getMaterialOptionsGridData } from "@/shared/constants/materialFilters";

const COUNTERTOP_OPTION = "Counertops materials";

export const CustomFaucetHolesPage = () => {
  const dispatch = useAppDispatch();
  const faucetAmount = useAppSelector(getFaucetHolesAmount);

  const activeCountertopColor = useAppSelector(getActiveCountertopColor);
  const activeThickness = useAppSelector(getActiveCountertopThickness);
  const activeBasinStyle = useAppSelector(getSinkType);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const sinkBaseDims = useSinkBaseDimensions(selectedProducts);

  const { data: counterTopData } = useGetCountertopDatatableQuery(438);

  const countertopRules = useMemo(() => parseCountertopMatrix(counterTopData), [counterTopData]);
  const countertopOptions = useMemo(() => getMaterialOptionsGridData(COUNTERTOP_OPTION), []);

  const activeMaterialTokens = useMemo(() => {
    if (!activeCountertopColor) return [];

    const match = countertopOptions.find((option) => {
      const candidate = option.metadata?.value ?? option.name ?? option.title ?? option.desc;
      return candidate === activeCountertopColor;
    });

    return match?.metadata?.materials ?? [];
  }, [activeCountertopColor, countertopOptions]);

  const ruleState = useMemo(
    () =>
      buildCountertopRuleState({
        rules: countertopRules,
        activeMaterialTokens,
        width: sinkBaseDims.width ?? selectedDimensions.width,
        depth: sinkBaseDims.depth ?? selectedDimensions.depth,
        activeBasinStyle,
        activeThickness,
      }),
    [
      activeBasinStyle,
      activeMaterialTokens,
      activeThickness,
      countertopRules,
      sinkBaseDims.depth,
      sinkBaseDims.width,
      selectedDimensions.depth,
      selectedDimensions.width,
    ],
  );

  const filteredFaucetHolesAmountData = useMemo(() => {
    const allowed = ruleState.allowedFaucetHoles;

    if (!allowed.size) return faucetHolesAmountData;

    return faucetHolesAmountData.filter((option) => {
      const candidate = String(option.title ?? option.id);
      return allowed.has(normalizeFaucetHoleToken(candidate));
    });
  }, [ruleState.allowedFaucetHoles]);

  const handleFaucetAmountChange = (value: string | null) => {
    if (!value) return;
    dispatch(setFaucetHolesAmount(value));
  };

  useEffect(() => {
    if (!filteredFaucetHolesAmountData.length) return;

    const currentStillValid = filteredFaucetHolesAmountData.some((option) => String(option.title ?? option.id) === faucetAmount);

    if (!currentStillValid) {
      const first = filteredFaucetHolesAmountData[0];
      const defaultAmount = String(first.title ?? first.id);
      dispatch(setFaucetHolesAmount(defaultAmount));
    }
  }, [dispatch, faucetAmount, filteredFaucetHolesAmountData]);

  const ACCORDIONS: AccordionConfig[] = [
    {
      id: "faucet-holes-amount",
      title: "Faucet Holes",
      defaultOpen: true,
      content: (
        <>
          <ProductSwatchesGrid
            data={filteredFaucetHolesAmountData}
            selectedValue={faucetAmount}
            onSelectChange={handleFaucetAmountChange}
          />
        </>
      ),
    },
  ];

  return (
    <div className="faucetPage">
      <ConfiguratorAccordionGroup defaultValue={ACCORDIONS.find((accordion) => accordion.defaultOpen)?.id.toString()}>
        {ACCORDIONS.map(({ id, title, content }) => (
          <ConfiguratorAccordionItem key={id} value={id.toString()} title={title}>
            {content}
          </ConfiguratorAccordionItem>
        ))}
      </ConfiguratorAccordionGroup>
    </div>
  );
};
