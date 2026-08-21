import { FieldError } from "react-hook-form";

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
  return (
    <div className={`flex flex-col gap-1.5 ${className || "w-full"}`}>
      <label className="text-[12px] font-medium text-[#181d26]">{label}</label>
      <input
        type={type}
        name={name}
        {...(register ? register(name) : {})}
        className="border border-[#dddddd] p-2.5 rounded-[6px] text-[13px] w-full focus:border-[#1b61c9] outline-none transition-all bg-white"
        {...inputProps}
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
        <p className="text-xs text-red-400">{error.message.toString()}</p>
      )}
    </div>
  );
};

export default InputField;
