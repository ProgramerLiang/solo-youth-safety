import { Capacitor, registerPlugin } from '@capacitor/core'

export interface ExportFileResult {
  saved: boolean
  location: string | null
  /** 原生保存失败时的原因;成功或 Web 环境为 null */
  error: string | null
}

interface NativeExportPlugin {
  saveFile(options: { fileName: string; mimeType: string; content: string }): Promise<ExportFileResult>
}

const NativeExport = registerPlugin<NativeExportPlugin>('NativeExport')

export async function saveExportFile(fileName: string, mimeType: string, content: string): Promise<ExportFileResult> {
  if (!Capacitor.isNativePlatform()) return { saved: false, location: null, error: null }
  try {
    const result = await NativeExport.saveFile({ fileName, mimeType, content })
    return { saved: result.saved, location: result.location ?? null, error: result.error ?? null }
  } catch (error) {
    return { saved: false, location: null, error: error instanceof Error ? error.message : String(error) }
  }
}
