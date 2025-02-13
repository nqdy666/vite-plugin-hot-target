// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    // Configures for antfu's config
  },
  {
    rules: {
      'no-console': 'off',
      'node/no-deprecated-api': 'off',
    },
  },
)
