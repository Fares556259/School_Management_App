# SnapSchool Web Design System

This document outlines the core design language, component structure, and styling guidelines for the SnapSchool Web Application. The design follows a sleek, professional "Linear / Airtable" aesthetic that prioritizes readability, data density, and structural clarity over bubbly or overly vibrant UI elements.

## 1. Core Principles
- **Crisp & Structural**: Avoid excessive border radii (`rounded-2xl`, `rounded-full` on large containers) and soft, large drop shadows.
- **High Contrast, Low Noise**: Use strict, neutral borders and sharp typography. Keep primary content dark and structural elements light.
- **Data-First**: Tables, forms, and lists should feel natively integrated into the page, maximizing usable space.

## 2. Color Palette
We rely on a highly constrained, premium color palette.

### Backgrounds
- **App Layout Background**: `#F5F6F8` (A subtle, cool gray that makes white cards pop).
- **Primary Cards/Containers**: `#ffffff` (Pure white).
- **Secondary Containers (Filter bars, table headers)**: `#f8fafc` (Slate 50 - very light blue-gray).

### Text
- **Primary Text (Titles, Data)**: `#181d26` (Near black, very sharp).
- **Secondary Text (Labels, Subtitles)**: `#5a5a5a` or `#41454d`.
- **Subdued/Placeholder Text**: `#9297a0`.

### Borders
- **Primary Structural Borders**: `#dddddd` (Clean, visible but not distracting).
- **Subtle Inner Dividers (Table rows)**: `#f0f0f0`.

### Accents & Status
- **Brand/Primary Accent**: Indigo (`#4f46e5` / `indigo-600`).
- **Success/Present**: Emerald (`bg-emerald-50 text-emerald-700 border-emerald-200/50`).
- **Warning/Late**: Amber (`bg-amber-50 text-amber-700 border-amber-200/50`).
- **Danger/Absent**: Rose (`bg-rose-50 text-rose-700 border-rose-200/50`).

## 3. Structural Elements

### Main Page Containers
Pages should sit inside the dashboard layout as floating cards, avoiding full-bleed `min-h-screen` attachments that cause empty space scrolling.
```tsx
<div className="p-6 flex flex-col gap-8 flex-1 bg-white rounded-[16px] border border-[#dddddd] shadow-sm">
  {/* Page Content */}
</div>
```

### Page Headers
Headers combine a gradient icon box with sharp typography and aligned actions.
```tsx
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
  <div className="flex items-start gap-4">
    {/* Gradient Icon Container */}
    <div className="w-12 h-12 rounded-[10px] bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
      <Users size={22} className="text-white" />
    </div>
    <div>
      <h1 className="text-[28px] font-semibold text-[#181d26] leading-none tracking-tight mb-2">Page Title</h1>
      <div className="flex items-center gap-2 text-[13px] font-medium text-[#5a5a5a]">
        <span>Subtitle / Context</span>
      </div>
    </div>
  </div>
  {/* Action Buttons Go Here */}
</div>
```

## 4. Components

### Buttons
Buttons should feel highly tactile, utilizing strict border radii and subtle active scaling.

**Primary Action Button (Dark):**
```tsx
<button className="px-4 py-2.5 rounded-[6px] bg-[#181d26] text-white hover:bg-[#0d1218] font-medium text-[13px] active:scale-[0.98] transition-all shadow-sm">
  Action
</button>
```

**Secondary Action Button (Outline):**
```tsx
<button className="px-4 py-2.5 rounded-[6px] bg-[#ffffff] text-[#181d26] hover:bg-[#f8fafc] border border-[#dddddd] font-medium text-[13px] active:scale-[0.98] transition-all shadow-sm">
  Cancel
</button>
```

### Inputs & Forms
Forms should be minimal. Inputs use `#dddddd` borders, `#181d26` text, and `rounded-[6px]`.
```tsx
<input 
  type="text" 
  className="w-full px-3 py-2.5 border border-[#dddddd] rounded-[6px] text-[13px] font-medium text-[#181d26] focus:border-indigo-500 focus:outline-none transition-all placeholder:font-normal placeholder:text-[#9297a0] bg-white"
  placeholder="Enter details..."
/>
```

### Filter Bars
Instead of scattered floating buttons, filters are grouped into a singular, cohesive bar resembling Airtable.
```tsx
<div className="flex flex-wrap items-center bg-[#f8fafc] border border-[#dddddd] rounded-[8px] px-3 py-2 gap-4 w-fit">
  {/* Search Block */}
  <div className="flex items-center gap-2 px-2 border-r border-[#dddddd] pr-6">
     <Search size={14} className="text-[#9297a0]" />
     <input className="bg-transparent border-0 text-[13px] font-medium text-[#181d26] focus:outline-none" />
  </div>
  {/* Dropdown Block */}
  <div className="flex items-center gap-3 px-2">
    <span className="text-[13px] font-medium text-[#41454d]">Filter Name</span>
    <select className="bg-transparent border-0 text-[13px] font-medium text-[#181d26] focus:outline-none cursor-pointer">
      <option>Option 1</option>
    </select>
  </div>
</div>
```

### Tables
Tables eschew external padding for a clean, full-width internal layout.
```tsx
<div className="bg-[#ffffff] border border-[#dddddd] rounded-[8px] overflow-x-auto">
  <table className="w-full text-left border-collapse">
    <thead>
      <tr className="border-b border-[#dddddd] bg-[#f8fafc]">
        <th className="px-4 py-3 text-[12px] font-medium text-[#41454d]">Header</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-[#f0f0f0] hover:bg-[#fafafa] last:border-none">
        <td className="px-4 py-3 text-[13px] font-medium text-[#181d26]">Data</td>
      </tr>
    </tbody>
  </table>
</div>
```

## 5. Typography Rules
- **Font**: Inter / system-ui (Standard Next.js sans setup).
- **Titles**: Heavy tracking (`tracking-tight`), tight line height (`leading-none`), semi-bold.
- **Data/Text**: Default to `text-[13px]`. Use `font-medium` for readability on most data points.
- **Micro-copy/Headers**: Default to `text-[12px]`.

## 6. Motion & Interaction
- Keep animations incredibly subtle.
- Use `transition-colors`, `transition-all`.
- Clickable elements should usually have `active:scale-[0.98]` to provide immediate, physical feedback.
