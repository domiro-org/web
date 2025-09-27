import { Container, Typography, Button, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";

export default function App() {
  const { t } = useTranslation();

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t("app.title")}
      </Typography>
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
