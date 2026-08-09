import { Capacitor, registerPlugin } from '@capacitor/core'

export interface ExportFileResult {
  saved: boolean
  location: string | null
}

interface NativeExportPlugin {
  saveFile(options: { fileName: string; mimeType: string; content: string }): Promise<ExportFileResult>
}

const NativeExport = registerPlugin<NativeExportPlugin>('NativeExport')

export async function saveExportFile(fileName: string, mimeType: string, content: string): Promise<ExportFileResult> {
  if (!Capacitor.isNativePlatform()) return { saved: false, location: null }
  try {
    return await NativeExport.saveFile({ fileName, mimeType, content })
  } catch {
    return { saved: false, location: null }
  }
}
