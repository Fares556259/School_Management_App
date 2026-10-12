import { FieldError } from "react-hook-form";
import { useId } from "react";

type InputFieldProps = {
  label: string;
  type?: string;
  register?: any;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  error?: FieldError;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  required?: boolean;
  className?: string;
};

const InputField = ({
  label,
  type = "text",
  register,
  name,
  defaultValue,
  placeholder,
  error,
  inputProps,
  required,
  className,
}: InputFieldProps) => {
  const generatedId = useId();
  const inputId = inputProps?.id || `${name}-${generatedId}`;
  const errorId = `${inputId}-error`;

  return (
    <div className={`flex flex-col gap-1.5 ${className || "w-full"}`}>
      <label htmlFor={inputId} className="ss-label">{label}</label>
      <input
        type={type}
        name={name}
        {...(register ? register(name) : {})}
        {...inputProps}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : inputProps?.["aria-describedby"]}
        className={`ss-field ${inputProps?.className || ""}`}
        onInput={(e) => {
          if (name === "phone") {
            const target = e.target as HTMLInputElement;
            target.value = target.value.replace(/[^0-9+]/g, '');
          }
          if (inputProps?.onInput) {
            inputProps.onInput(e);
          }
        }}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
      />
      {error?.message && (
        <p id={errorId} role="alert" className="text-xs text-rose-600">{error.message.toString()}</p>
      )}
    </div>
  );
};

export default InputField;
