export const profileApi = {
  getIntegrationCredentialCapability() {
    return {
      readSupported: true,
      writeSupported: true,
      message: 'Credentials are managed through the retained credentials API.',
      plannedRoutes: ['/credentials'],
    };
  },
};
