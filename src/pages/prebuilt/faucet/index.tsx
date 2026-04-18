import { useEffect, useMemo } from "react";

import { useGetConfiguratorQuery } from "@/entities";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import type { AccordionConfig } from "@/shared/constants/types";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  getActiveCountertopColor,
  getCountertopColorSku,
  getActiveCountertopThickness,
  getFaucetHolesAmount,
  getSelectedDimensions,
  getSelectedProducts,
  getSinkType,
} from "@/entities/product/model/store/selectors";
import { useSinkBaseDimensions } from "@/shared/hooks/useSinkBaseDimensions";
import { setFaucetHolesAmount } from "@/entities/product/model/store/slice";
import {
  buildCountertopRuleState,
  getSupportedCountertopFaucetHoles,
  normalizeFaucetHoleToken,
  useCountertopRules,
} from "@/features/configurator-rule-core/countertop";
import {
  buildCountertopColorSkuCandidates,
  getCountertopMaterialTokensFromBasinType,
  resolveCountertopMaterialTokensFromCandidates,
} from "@/shared/lib/sku";

export const FaucetPage = () => {
  const dispatch = useAppDispatch();
  const faucetAmount = useAppSelector(getFaucetHolesAmount);

  const activeCountertopColor = useAppSelector(getActiveCountertopColor);
  const countertopColorSku = useAppSelector(getCountertopColorSku);
  const activeThickness = useAppSelector(getActiveCountertopThickness);
  const activeBasinStyle = useAppSelector(getSinkType);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const sinkBaseDims = useSinkBaseDimensions(selectedProducts);

  const { data: counterTopMaterials } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

  const countertopRules = useCountertopRules();
  const countertopColorSkuCandidatesByValue = useMemo(
    () => buildCountertopColorSkuCandidates(counterTopMaterials?.availableOptions),
    [counterTopMaterials?.availableOptions],
  );
  const faucetHoleOptions = useMemo(
    () =>
      getSupportedCountertopFaucetHoles(countertopRules).map((value) => ({
        id: Number(value),
        title: value,
      })),
    [countertopRules],
  );

  const activeMaterialTokens = useMemo(() => {
    return resolveCountertopMaterialTokensFromCandidates({
      value: activeCountertopColor,
      candidatesByValue: countertopColorSkuCandidatesByValue,
      preferredSku: countertopColorSku,
      preferredMaterialTokens: getCountertopMaterialTokensFromBasinType(activeBasinStyle),
    });
  }, [activeBasinStyle, activeCountertopColor, countertopColorSku, countertopColorSkuCandidatesByValue]);

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

    if (!allowed.size) return faucetHoleOptions;

    return faucetHoleOptions.filter((option) => {
      const candidate = String(option.title ?? option.id);
      return allowed.has(normalizeFaucetHoleToken(candidate));
    });
  }, [faucetHoleOptions, ruleState.allowedFaucetHoles]);

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
