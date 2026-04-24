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
    <div className={`flex flex-col gap-2 ${className || "w-full"}`}>
      <label className="text-xs text-gray-500">{label}</label>
      <input
        type={type}
        name={name}
        {...(register ? register(name) : {})}
        className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full"
        {...inputProps}
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
