import { useEffect, useMemo } from "react";

import { useActiveCollection } from "@/entities/collection";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { FAUCET_HOLE_HELPER_COPY } from "@/shared/constants/faucetHoles";
import type { AccordionConfig } from "@/shared/constants/types";
import { useAppSelector } from "@/shared/hooks/store/redux";
import {
  getActiveCountertopColor,
  getCountertopColorSku,
  getActiveCountertopThickness,
  getCountertopStyle,
  getFaucetHolesAmount,
  getSelectedDimensions,
  getSelectedProducts,
  getSinkType,
} from "@/entities/product/model/store/selectors";
import { useSinkBaseDimensions } from "@/shared/hooks/useSinkBaseDimensions";
import {
  buildCountertopRuleState,
  getSupportedCountertopFaucetHoles,
  normalizeFaucetHoleToken,
  useCountertopRules,
} from "@/features/configurator-rule-core/countertop";
import { resolveChangeRequest, useAttributeChangeHandler, useChangeAttribute } from "@/features/configurationCommands";
import {
  buildCountertopColorSkuCandidates,
  getCountertopMaterialTokensFromBasinType,
  resolveCountertopMaterialTokensFromCandidates,
} from "@/shared/lib/sku";

import s from "./CustomFaucetHolesPage.module.scss";

export const CustomFaucetHolesPage = () => {
  const faucetAmount = useAppSelector(getFaucetHolesAmount);
  const faucetHoles = useAttributeChangeHandler("FaucetHolesAmount");
  const { change, getState } = useChangeAttribute();

  const activeCountertopColor = useAppSelector(getActiveCountertopColor);
  const countertopColorSku = useAppSelector(getCountertopColorSku);
  const activeThickness = useAppSelector(getActiveCountertopThickness);
  const activeCountertopStyle = useAppSelector(getCountertopStyle);
  const activeBasinStyle = useAppSelector(getSinkType);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const sinkBaseDims = useSinkBaseDimensions(selectedProducts);

  const configuratorGroups = useActiveCollection((collection) => collection.catalog.configurator.groups);
  const countertopRules = useCountertopRules();
  const countertopColorSkuCandidatesByValue = useMemo(
    () => buildCountertopColorSkuCandidates(configuratorGroups),
    [configuratorGroups],
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
        activeCountertopStyle,
        activeBasinStyle,
        activeThickness,
      }),
    [
      activeBasinStyle,
      activeCountertopStyle,
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
    void faucetHoles.onChange(value);
  };

  useEffect(() => {
    if (!filteredFaucetHolesAmountData.length) return;

    const currentStillValid = filteredFaucetHolesAmountData.some((option) => String(option.title ?? option.id) === faucetAmount);

    if (!currentStillValid) {
      const first = filteredFaucetHolesAmountData[0];
      const defaultAmount = String(first.title ?? first.id);
      // A default the rules pick is not a user step, so it leaves no history entry.
      const request = resolveChangeRequest(getState(), "FaucetHolesAmount", defaultAmount);
      if (request) void change(request);
    }
  }, [change, faucetAmount, filteredFaucetHolesAmountData, getState]);

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
          {FAUCET_HOLE_HELPER_COPY[faucetAmount] && (
            <p className={s.helperText}>{FAUCET_HOLE_HELPER_COPY[faucetAmount]}</p>
          )}
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
