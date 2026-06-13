import { create } from 'zustand'

interface UiState {
  drawerOpen: boolean
  drawerOffset: number
  feedbackExpanded: boolean
  resultText: string
  openDrawer: () => void
  closeDrawer: () => void
  setDrawerOffset: (offset: number) => void
  toggleFeedback: () => void
  setFeedbackExpanded: (expanded: boolean) => void
  setResult: (text: string) => void
}

export const useUiStore = create<UiState>((set) => ({
  drawerOpen: false,
  drawerOffset: 0,
  feedbackExpanded: false,
  resultText: '',

  openDrawer: () => set({ drawerOpen: true, drawerOffset: 0 }),
  closeDrawer: () => set({ drawerOpen: false, drawerOffset: 0 }),
  setDrawerOffset: (offset) => set({ drawerOffset: offset }),
  toggleFeedback: () => set((s) => ({ feedbackExpanded: !s.feedbackExpanded })),
  setFeedbackExpanded: (expanded) => set({ feedbackExpanded: expanded }),
  setResult: (text) => set({ resultText: text }),
}))