/**
 * Accessibility Components Index
 *
 * Re-exports all accessibility-related components and hooks.
 */

// Components
export { FocusTrap, useFocusTrap } from './FocusTrap'
export { SkipLinks, MainContent, Navigation, SearchRegion, ComplementaryRegion } from './SkipLinks'
export {
  IconButton,
  FormField,
  SelectField,
  TextareaField,
  Checkbox,
  LiveRegion,
  VisuallyHidden,
  AccessibleLoader,
  Alert
} from './AccessibleComponents'

// Re-export hooks from hooks directory
export {
  useFocusOnMount,
  useRovingTabindex,
  useAnnounce,
  usePrefersReducedMotion,
  usePrefersColorScheme,
  useFocusVisible,
  useEscapeKey,
  useClickOutside,
  useExpanded
} from '../../hooks/useAccessibility'
