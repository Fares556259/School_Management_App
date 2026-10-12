# SnapSchool brand system — Le lien

This system keeps the existing SnapSchool and school logos. It defines the interface around them so the public site, authentication and school workspace feel like one product.

## Core palette

| Token | Value | Use |
| --- | --- | --- |
| `brand-600` | `#233BDB` | Primary actions, active navigation, links and focus |
| `brand-700` | `#1C2FB2` | Hover and pressed actions |
| `brand-50` | `#F0F2FE` | Selected rows and quiet branded surfaces |
| `ink-900` | `#182136` | Primary text and deep neutral surfaces |
| `ink-500` | `#59677D` | Secondary text |
| `paper` | `#F3F2EC` | Application background |
| `apricot` | `#F4B58D` | Restrained identity accent on marketing surfaces |

Green, amber and red remain reserved for real success, warning and failure states. Apricot must not represent operational status.

## Typography

- Manrope is the main Latin interface typeface.
- IBM Plex Sans Arabic is the Arabic interface typeface.
- Use sentence case for controls and headings.
- Page headings use `font-semibold` with slightly tight tracking. Body copy uses regular or medium weight.

Both families are bundled locally under `src/fonts`, including their OFL licenses. The interface does not depend on a font request to a third-party service.

## Shape and elevation

- Controls: 8 px (`rounded-control`)
- Panels: 12 px (`rounded-panel`)
- Dialogs: 16 px (`rounded-dialog`)
- Panels use a thin neutral border and `shadow-panel`.
- Dialogs use `shadow-overlay`.
- Avoid decorative glow, heavy gradients and large floating shadows in the operational interface.

## Shared classes

- `ss-panel`
- `ss-dialog`
- `ss-field`
- `ss-label`
- `ss-button-primary`
- `ss-button-secondary`
- `ss-icon-button`

New screens should use these classes or the token-backed UI components before adding page-specific styles.

## Interaction rules

- Every interactive element needs a visible focus state.
- Icon-only buttons need an accessible label.
- Selected navigation uses deep blue and `aria-current="page"`.
- Empty and loading states must explain what is happening rather than resemble missing content.
- School logos and names remain tenant-controlled and are never recolored by the brand layer.
