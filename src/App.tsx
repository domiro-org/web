import { Container, Typography, Button, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";

import LanguageSwitcher from "./components/LanguageSwitcher";

export default function App() {
  const { t } = useTranslation();

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t("app.title")}
      </Typography>

      <LanguageSwitcher fullWidth sx={{ mb: 2 }} />

      <TextField
        fullWidth
        placeholder={t("input.placeholder")}
        multiline
        minRows={4}
        sx={{ mb: 2 }}
      />
      <Button variant="contained">{t("action.check")}</Button>
    </Container>
  );
}
