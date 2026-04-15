export interface IMaterialMetadata {
  Look?: string;
  Color?: string;
  image?: string;
  hex?: string;
  label?: string;
  value?: string;
  Material?: string;
  Finish?: string;
  zoomIconColor?: string;
  [key: string]: string | undefined;
}

export interface AttributeValue {
  id: string;
  count: number;
  assetId?: string;
  name?: string;
  metadata?: IMaterialMetadata;
  parentName: string;
  label: string;
  value?: string;
  optionName?: string;
}

export interface IProductElementOption {
  id: string;
  value: string;
  label: string;
  valuesArray: AttributeValue[];
}

export interface IMaterialSelectState {
  Finish: string[];
  Color: string[];
  Look: string[];
}

export type TFilterName = keyof IMaterialSelectState;

export interface ISetFiltersPayload {
  filterName: TFilterName;
  values: string[];
}

export interface ISwatchOrderSlice {
  isOpen: boolean;
  activeProductElement: string | null;
  productElementOptions: IProductElementOption[];
  allMaterialsValues: AttributeValue[];
  materialSelectState: IMaterialSelectState;
  selectedMaterials: AttributeValue[];
  isEnabledInSummary: boolean;
  isAutofillEnabled: boolean;
  hasSubmittedCart: boolean;
}

export interface IMapUIData {
  allMaterialValues: AttributeValue[];
  productElementOptions: IProductElementOption[];
}

interface IThreekitVariant {
  id: number;
  name: string;
  image?: string | null;
  enabled: boolean;
  metadata: {
    label?: string;
    Label?: string;
    value?: string;
    metadata?: IMaterialMetadata;
    [key: string]: unknown;
  };
}

interface IThreekitGroup {
  id: number;
  proxyName: string;
  proxyType: string;
  enabled: boolean;
  options: { id: number; name: string; variants: IThreekitVariant[] }[];
}

export interface IThreekitConfiguration {
  availableOptions: IThreekitGroup[];
}
