import { useEffect, useId, useRef, useState } from "react";

import "./hubspot-forms.css";

type HubspotCallback = (...args: unknown[]) => void;
type HubspotHiddenFields = Record<string, string | null | undefined>;

type HubspotFormProps = {
  portalId: string;
  formId: string;
  region?: string;
  redirectUrl?: string;
  onFormReady?: HubspotCallback;
  onFormSubmit?: HubspotCallback;
  onFormSubmitted?: HubspotCallback;
  customStyle?: boolean;
  customCss?: string;
  hiddenFields?: HubspotHiddenFields;
};

type HubspotFormsApi = {
  forms: {
    create: (config: HubspotCreateFormConfig) => void;
  };
};

type HubspotCreateFormConfig = {
  portalId: string;
  formId: string;
  region: string;
  target: string;
  redirectUrl?: string;
  css?: string;
  cssRequired?: string;
  onFormReady?: HubspotCallback;
  onFormSubmit?: HubspotCallback;
  onFormSubmitted?: HubspotCallback;
};

type HubspotMessage = {
  type?: string;
  id?: string;
  eventName?: string;
};

declare global {
  interface Window {
    hbspt?: HubspotFormsApi;
  }
}

const isHubspotMessage = (value: unknown): value is HubspotMessage => {
  return typeof value === "object" && value !== null && "type" in value;
};

const escapeAttributeValue = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const syncHubspotFieldValues = (root: HTMLElement | null, values: HubspotHiddenFields | undefined) => {
  if (!root || !values) return;

  Object.entries(values).forEach(([name, value]) => {
    const normalizedValue = value?.trim();
    if (!name || !normalizedValue) return;

    const field = root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      `[name="${escapeAttributeValue(name)}"]`,
    );
    if (!field) return;

    field.value = normalizedValue;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

const HubspotForm = ({
  portalId,
  formId,
  region = "na1",
  redirectUrl,
  onFormReady,
  onFormSubmit,
  onFormSubmitted,
  customStyle = false,
  customCss,
  hiddenFields,
}: HubspotFormProps) => {
  const reactId = useId().replace(/:/g, "");
  const targetId = `hubspot-form-target-${reactId}`;
  const formRef = useRef<HTMLDivElement | null>(null);
  const formCreated = useRef(false);
  const formSubmittedRef = useRef(false);
  const formSubmitRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);

  const callbacksRef = useRef({ onFormReady, onFormSubmit, onFormSubmitted });
  const hiddenFieldsRef = useRef(hiddenFields);

  useEffect(() => {
    callbacksRef.current = { onFormReady, onFormSubmit, onFormSubmitted };
  }, [onFormReady, onFormSubmit, onFormSubmitted]);

  useEffect(() => {
    hiddenFieldsRef.current = hiddenFields;
    syncHubspotFieldValues(formRef.current, hiddenFields);
  }, [hiddenFields]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!isHubspotMessage(event.data) || event.data.type !== "hsFormCallback" || event.data.id !== formId) {
        return;
      }

      if (event.data.eventName === "onFormSubmit" && !formSubmitRef.current) {
        formSubmitRef.current = true;
        syncHubspotFieldValues(formRef.current, hiddenFieldsRef.current);
        callbacksRef.current.onFormSubmit?.();
      }

      if (event.data.eventName === "onFormSubmitted" && !formSubmittedRef.current) {
        formSubmittedRef.current = true;
        syncHubspotFieldValues(formRef.current, hiddenFieldsRef.current);
        callbacksRef.current.onFormSubmitted?.();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [formId]);

  useEffect(() => {
    if (formCreated.current) return;

    const loadScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.hbspt?.forms) {
          resolve();
          return;
        }

        if (document.querySelector('script[src*="js.hsforms.net"]')) {
          const checkHbspt = window.setInterval(() => {
            if (window.hbspt?.forms) {
              window.clearInterval(checkHbspt);
              resolve();
            }
          }, 100);
          return;
        }

        const script = document.createElement("script");
        script.charset = "utf-8";
        script.type = "text/javascript";
        script.src = "//js.hsforms.net/forms/embed/v2.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load HubSpot forms script"));
        document.head.appendChild(script);
      });
    };

    let createdFormElement: HTMLDivElement | null = null;

    const createForm = () => {
      if (!formRef.current || formCreated.current || !window.hbspt?.forms) return;

      formRef.current.innerHTML = "";
      formRef.current.id = targetId;
      createdFormElement = formRef.current;

      const formConfig: HubspotCreateFormConfig = {
        portalId,
        formId,
        region,
        target: `#${targetId}`,
      };

      if (redirectUrl) {
        formConfig.redirectUrl = redirectUrl;
      }

      if (customStyle) {
        formConfig.css = "";
        formConfig.cssRequired = customCss ?? "";
      }

      formConfig.onFormReady = (...args) => {
        syncHubspotFieldValues(formRef.current, hiddenFieldsRef.current);
        setIsLoading(false);
        callbacksRef.current.onFormReady?.(...args);
      };

      formConfig.onFormSubmit = (...args) => {
        if (formSubmitRef.current) return;
        formSubmitRef.current = true;
        syncHubspotFieldValues(formRef.current, hiddenFieldsRef.current);
        callbacksRef.current.onFormSubmit?.(...args);
      };

      formConfig.onFormSubmitted = (...args) => {
        if (formSubmittedRef.current) return;
        formSubmittedRef.current = true;
        syncHubspotFieldValues(formRef.current, hiddenFieldsRef.current);
        callbacksRef.current.onFormSubmitted?.(...args);
      };

      try {
        window.hbspt.forms.create(formConfig);
        formCreated.current = true;
      } catch (error) {
        console.error("Error creating HubSpot form:", error);
        setIsLoading(false);
      }
    };

    const initializeForm = async () => {
      if (!portalId || !formId) {
        console.error("HubSpot form requires portalId and formId");
        setIsLoading(false);
        return;
      }

      try {
        await loadScript();
        window.setTimeout(createForm, 300);
      } catch (error) {
        console.error("Failed to load HubSpot script:", error);
        setIsLoading(false);
      }
    };

    void initializeForm();

    return () => {
      if (createdFormElement) {
        createdFormElement.innerHTML = "";
      }
      formCreated.current = false;
      formSubmittedRef.current = false;
      formSubmitRef.current = false;
      setIsLoading(true);
    };
  }, [portalId, formId, region, redirectUrl, customStyle, customCss, targetId]);

  return (
    <div className="hubspot-form-wrapper">
      {isLoading && (
        <div className="hubspot-form-loading">
          <div className="hubspot-form-skeleton hubspot-form-skeleton-large" />
          <div className="hubspot-form-skeleton hubspot-form-skeleton-small" />
        </div>
      )}
      <div
        ref={formRef}
        className={`hubspot-form-container ${isLoading ? "hidden" : ""} ${customStyle ? "hubspot-form-custom" : ""}`}
        aria-label="Contact form"
      />
    </div>
  );
};

export default HubspotForm;
