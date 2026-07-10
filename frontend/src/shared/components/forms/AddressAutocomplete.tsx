import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { LoaderCircle, MapPin } from "lucide-react";

import {
  geocodingApi,
  type AddressSuggestion,
  type AddressSuggestionField,
} from "../../api/geocoding.api";
import FormField from "../ui/FormField";
import Input from "../ui/Input";

type AddressField = "address" | "city" | "postal_code";
type SuggestionStatus = "idle" | "loading" | "empty" | "error";
type SearchRequest = {
  field: AddressField;
  query: string;
};

export type AddressValue = Record<AddressField, string>;

type AddressAutocompleteProps = {
  addressClassName?: string;
  cityClassName?: string;
  errors?: Partial<Record<AddressField, string>>;
  ids?: {
    address?: string;
    city?: string;
    postalCode?: string;
  };
  postalCodeClassName?: string;
  value: AddressValue;
  onChange: (field: AddressField, value: string) => void;
};

const fieldConfig: Record<
  AddressField,
  {
    autoComplete: string;
    inputMode?: "numeric";
    label: string;
    minQueryLength: number;
    placeholder: string;
  }
> = {
  address: {
    autoComplete: "street-address",
    label: "Adresse",
    minQueryLength: 3,
    placeholder: "8 rue du Port",
  },
  city: {
    autoComplete: "address-level2",
    label: "Ville",
    minQueryLength: 3,
    placeholder: "Marseille",
  },
  postal_code: {
    autoComplete: "postal-code",
    inputMode: "numeric",
    label: "Code postal",
    minQueryLength: 3,
    placeholder: "13002",
  },
};

export default function AddressAutocomplete({
  addressClassName,
  cityClassName,
  errors = {},
  ids,
  postalCodeClassName,
  value,
  onChange,
}: AddressAutocompleteProps) {
  const [activeField, setActiveField] = useState<AddressField | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchRequest, setSearchRequest] = useState<SearchRequest | null>(null);
  const [status, setStatus] = useState<SuggestionStatus>("idle");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const blurTimeout = useRef<number | null>(null);

  const fieldIds = {
    address: ids?.address ?? "address",
    city: ids?.city ?? "city",
    postal_code: ids?.postalCode ?? "postal_code",
  };

  const activeQuery = activeField ? value[activeField].trim() : "";

  useEffect(() => {
    if (!searchRequest) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStatus("loading");
      void geocodingApi
        .suggestions(
          searchRequest.query,
          searchRequest.field as AddressSuggestionField,
          controller.signal,
        )
        .then((result) => {
          if (controller.signal.aborted) return;
          const nextSuggestions = result.ok ? result.data : [];
          setSuggestions(nextSuggestions);
          setHighlightedIndex(-1);
          setStatus(
            !result.ok ? "error" : nextSuggestions.length > 0 ? "idle" : "empty",
          );
        });
    }, 240);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchRequest]);

  const clearBlurTimeout = () => {
    if (blurTimeout.current !== null) {
      window.clearTimeout(blurTimeout.current);
      blurTimeout.current = null;
    }
  };

  const closeSuggestions = () => {
    setActiveField(null);
    setHighlightedIndex(-1);
    setSearchRequest(null);
    setSuggestions([]);
    setStatus("idle");
  };

  const selectSuggestion = (suggestion: AddressSuggestion) => {
    if (activeField === "address") {
      onChange("address", suggestion.address);
      onChange("city", suggestion.city);
      onChange("postal_code", suggestion.postal_code);
    } else if (activeField === "city") {
      onChange("city", suggestion.city);
      onChange("postal_code", suggestion.postal_code);
    } else if (activeField === "postal_code") {
      onChange("postal_code", suggestion.postal_code);
      onChange("city", suggestion.city);
    }

    setSuggestions([]);
    closeSuggestions();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!activeField || suggestions.length === 0) {
      if (event.key === "Escape") closeSuggestions();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      );
    } else if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[highlightedIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeSuggestions();
    }
  };

  const renderSuggestions = (field: AddressField) => {
    const config = fieldConfig[field];
    const isOpen =
      activeField === field &&
      activeQuery.length >= config.minQueryLength &&
      (status !== "idle" || suggestions.length > 0);
    if (!isOpen) return null;

    const listId = `${fieldIds[field]}-suggestions`;

    return (
      <div className="address-autocomplete__panel" id={listId} role="listbox">
        {status === "loading" ? (
          <div className="address-autocomplete__loading">
            <LoaderCircle size={16} aria-hidden="true" />
          </div>
        ) : status === "empty" ? (
          <div className="address-autocomplete__message">
            Aucune suggestion trouvee
          </div>
        ) : status === "error" ? (
          <div className="address-autocomplete__message">
            Suggestions indisponibles
          </div>
        ) : (
          suggestions.map((suggestion, index) => {
            const labels = getSuggestionLabels(field, suggestion);

            return (
              <button
                aria-selected={index === highlightedIndex}
                className={[
                  "address-autocomplete__option",
                  index === highlightedIndex ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                id={`${listId}-${index}`}
                key={`${suggestion.label}-${suggestion.latitude}-${suggestion.longitude}`}
                role="option"
                type="button"
                onClick={() => selectSuggestion(suggestion)}
                onMouseDown={(event) => event.preventDefault()}
              >
                <MapPin size={16} aria-hidden="true" />
                <span>
                  <strong>{labels.primary}</strong>
                  <small>{labels.secondary}</small>
                </span>
              </button>
            );
          })
        )}
      </div>
    );
  };

  const renderField = (field: AddressField, className?: string) => {
    const config = fieldConfig[field];
    const listId = `${fieldIds[field]}-suggestions`;

    return (
      <FormField
        className={className}
        label={config.label}
        htmlFor={fieldIds[field]}
        error={errors[field]}
      >
        <div className="address-autocomplete">
          <Input
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={
              activeField === field && suggestions.length > 0 ? true : undefined
            }
            aria-activedescendant={
              activeField === field && highlightedIndex >= 0
                ? `${listId}-${highlightedIndex}`
                : undefined
            }
            autoComplete={config.autoComplete}
            hasError={!!errors[field]}
            id={fieldIds[field]}
            inputMode={config.inputMode}
            placeholder={config.placeholder}
            role="combobox"
            type="text"
            value={value[field]}
            onBlur={() => {
              blurTimeout.current = window.setTimeout(closeSuggestions, 140);
            }}
            onChange={(event) => {
              const nextValue = event.target.value;
              const nextQuery = nextValue.trim();

              setSuggestions([]);
              setHighlightedIndex(-1);
              setStatus("idle");
              setActiveField(field);
              setSearchRequest(
                nextQuery.length >= config.minQueryLength
                  ? {
                      field,
                      query: nextQuery,
                    }
                  : null,
              );
              onChange(field, nextValue);
            }}
            onFocus={() => {
              clearBlurTimeout();
              setActiveField(field);
              setSearchRequest(null);
              setSuggestions([]);
              setHighlightedIndex(-1);
              setStatus("idle");
            }}
            onKeyDown={handleKeyDown}
          />
          {renderSuggestions(field)}
        </div>
      </FormField>
    );
  };

  return (
    <>
      {renderField("address", addressClassName)}
      {renderField("city", cityClassName)}
      {renderField("postal_code", postalCodeClassName)}
    </>
  );
}

function getSuggestionLabels(field: AddressField, suggestion: AddressSuggestion) {
  if (field === "city") {
    return {
      primary: suggestion.city,
      secondary: suggestion.postal_code,
    };
  }

  if (field === "postal_code") {
    return {
      primary: suggestion.postal_code,
      secondary: suggestion.city,
    };
  }

  return {
    primary: suggestion.address,
    secondary: `${suggestion.postal_code} ${suggestion.city}`,
  };
}
