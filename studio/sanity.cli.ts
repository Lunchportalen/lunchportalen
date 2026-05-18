import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: "f3vuhd2f",
    dataset: "production",
  },
  deployment: {
    autoUpdates: false,
  },
});
