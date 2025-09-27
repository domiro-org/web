import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import type { TextFieldProps } from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import i18n from "../i18n/i18n";

const languages = [
  { code: "zh-Hans", label: "简体中文" },
  { code: "en-US", label: "English (US)" }
];

export type LanguageSwitcherProps = Omit<
  TextFieldProps,
  "select" | "label" | "value" | "onChange" | "children"
>;

export default function LanguageSwitcher(props: LanguageSwitcherProps) {
  const { t } = useTranslation();

  const handleChange: NonNullable<TextFieldProps["onChange"]> = (event) => {
    const { value } = event.target;
    if (typeof value === "string") {
      void i18n.changeLanguage(value);
    }
  };

  return (
    <TextField
      select
      label={t("language.select")}
      value={i18n.language}
      onChange={handleChange}
      {...props}
    >
      {languages.map((lang) => (
        <MenuItem key={lang.code} value={lang.code}>
          {lang.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
