import { DropdownMenu } from "@/ui/components/dropdown-menu"
import { IconButton } from "@/ui/components/icon-button"
import { useLanguage } from "@/context/language"
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_FILE_TYPES } from "@/components/prompt-input/attachments"

export type AddMenuFile = {
  file: File
  dataUrl: string
}

interface AddMenuProps {
  onFileSelect: (files: AddMenuFile[]) => void
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function AddMenu(props: AddMenuProps) {
  const language = useLanguage()

  let fileInputRef: HTMLInputElement | undefined
  let imageInputRef: HTMLInputElement | undefined

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const results: AddMenuFile[] = []
    for (const file of Array.from(files)) {
      const dataUrl = await readFileAsDataUrl(file)
      results.push({ file, dataUrl })
    }
    props.onFileSelect(results)
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        class="hidden"
        accept={ACCEPTED_FILE_TYPES.join(",")}
        multiple
        onChange={(e) => {
          handleFiles(e.currentTarget.files)
          e.currentTarget.value = ""
        }}
      />
      <input
        ref={imageInputRef}
        type="file"
        class="hidden"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple
        onChange={(e) => {
          handleFiles(e.currentTarget.files)
          e.currentTarget.value = ""
        }}
      />
      <DropdownMenu>
        <DropdownMenu.Trigger
          as={IconButton}
          icon="plus-small"
          variant="ghost"
          class="size-8"
          aria-label={language.t("home.v2.addMenu.title")}
        />
        <DropdownMenu.Portal>
          <DropdownMenu.Content class="min-w-40">
            <DropdownMenu.Item onSelect={() => fileInputRef?.click()}>
              <DropdownMenu.ItemLabel>
                {language.t("home.v2.addMenu.attachFile")}
              </DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => imageInputRef?.click()}>
              <DropdownMenu.ItemLabel>
                {language.t("home.v2.addMenu.attachImage")}
              </DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </>
  )
}
