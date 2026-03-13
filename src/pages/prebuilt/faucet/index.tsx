import { useEffect, useMemo } from "react";

import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import type { AccordionConfig } from "@/shared/constants/types";
import { FilterSelection } from "@/shared/ui/Filter/FilterSelection";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getFaucetHolesAmount,
  getFaucetHolesSpacing,
  getSelectedDimensions,
  getSinkType,
} from "@/entities/product/model/store/selectors";
import { setFaucetHolesAmount, setFaucetHolesSpacing } from "@/entities/product/model/store/slice";
import { useGetCountertopDatatableQuery } from "@/entities/countertop";
import {
  buildCountertopRuleState,
  normalizeFaucetHoleToken,
  parseCountertopMatrix,
} from "@/features/configurator-rule-core/countertop";
import { getMaterialOptionsGridData } from "@/shared/constants/materialFilters";

const COUNTERTOP_OPTION = "Counertops materials";

const faucetHolesAmountData = [
  {
    id: 0,
    title: "0",
  },
  {
    id: 1,
    title: "1",
  },
  {
    id: 2,
    title: "2",
  },
  {
    id: 3,
    title: "3",
  },
  {
    id: 4,
    title: "4",
  },
  {
    id: 5,
    title: "5",
  },
];

const faucetHolesSpacingOptions = [
  {
    label: '4"',
    value: '4"',
  },
];

export const FaucetPage = () => {
  const dispatch = useAppDispatch();
  const faucetSpacing = useAppSelector(getFaucetHolesSpacing);
  const faucetAmount = useAppSelector(getFaucetHolesAmount);

  const activeCountertopColor = useAppSelector(getActiveCountertopColor);
  const activeThickness = useAppSelector(getActiveCountertopThickness);
  const activeBasinStyle = useAppSelector(getSinkType);
  const selectedDimensions = useAppSelector(getSelectedDimensions);

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
        width: selectedDimensions.width,
        depth: selectedDimensions.depth,
        activeBasinStyle,
        activeThickness,
      }),
    [
      activeBasinStyle,
      activeMaterialTokens,
      activeThickness,
      countertopRules,
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

  const handleFaucetSpacingChange = (value?: string | number) => {
    if (value === undefined) return;
    dispatch(setFaucetHolesSpacing(String(value)));
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

  useEffect(() => {
    const defaultSpacing = String(faucetHolesSpacingOptions[0]?.value ?? "");
    if (!defaultSpacing) return;
    if (!faucetSpacing) {
      dispatch(setFaucetHolesSpacing(defaultSpacing));
    }
  }, [dispatch, faucetSpacing]);

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
    {
      id: "faucet-holes-spacing",
      title: "Faucet Hole Spacing",
      content: (
        <>
          <FilterSelection
            label="Spacing"
            options={faucetHolesSpacingOptions}
            value={faucetSpacing}
            onSelect={handleFaucetSpacingChange}
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
