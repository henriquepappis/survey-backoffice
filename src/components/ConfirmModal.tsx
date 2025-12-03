type ConfirmModalProps = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  confirmLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const ConfirmModal = ({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmLoading,
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  if (!open) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal confirm">
        <div className="modal__header">
          <div>
            <p className="eyebrow">Confirmação</p>
            <h2>{title}</h2>
          </div>
        </div>
        <div className="modal__content">
          <p>{description}</p>
        </div>
        <div className="modal__footer">
          <button className="btn ghost" type="button" onClick={onCancel} disabled={confirmLoading}>
            {cancelLabel}
          </button>
          <button className="btn danger" type="button" onClick={onConfirm} disabled={confirmLoading}>
            {confirmLoading ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
