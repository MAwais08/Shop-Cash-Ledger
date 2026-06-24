import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import NewTransaction from './NewTransaction'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

beforeEach(async () => {
  mockNavigate.mockClear()
  useAppStore.setState({ data: null, authed: false, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
})

function renderPage() {
  return render(<BrowserRouter><NewTransaction /></BrowserRouter>)
}

describe('NewTransaction — guided form', () => {
  it('shows the five transaction types', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /^deposit$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^withdraw$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^easyload$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^package$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^other$/i })).toBeInTheDocument()
  })

  it('Deposit shows the commission-mode toggle and a derived target', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^deposit$/i }))
    expect(screen.getByRole('button', { name: /fee in cash/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fee in wallet/i })).toBeInTheDocument()
    // Enter amount 1000, commission 20 → target drawer +1020
    const [amountInput, commissionInput] = screen.getAllByRole('spinbutton')
    fireEvent.change(amountInput, { target: { value: '1000' } })
    fireEvent.change(commissionInput, { target: { value: '20' } })
    expect(screen.getByTestId('derived-target')).toHaveTextContent(/1,020/)
  })

  it('disables Confirm until the entered notes net to the target', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^deposit$/i }))
    const [amountInput, commissionInput] = screen.getAllByRole('spinbutton')
    fireEvent.change(amountInput, { target: { value: '1000' } })
    fireEvent.change(commissionInput, { target: { value: '20' } })

    const confirm = screen.getByRole('button', { name: /confirm|submit|save/i })
    expect(confirm).toBeDisabled()

    // Add Rs 1000 + Rs 20 received = 1020 net
    const received = screen.getByText(/notes received/i).closest('.rounded-xl') as HTMLElement
    fireEvent.click(within(received).getByRole('button', { name: /add Rs 1000/i }))
    fireEvent.click(within(received).getByRole('button', { name: /add Rs 20/i }))
    await waitFor(() => expect(confirm).not.toBeDisabled())
  })

  it('submits a valid deposit and writes the derived AppData', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^deposit$/i }))

    const walletSelect = screen.getByLabelText(/^wallet$/i) as HTMLSelectElement
    fireEvent.change(walletSelect, { target: { value: walletSelect.options[1].value } })
    const walletId = walletSelect.options[1].value
    const before = useAppStore.getState().data!.wallets.find((w) => w.id === walletId)!.balance

    const [amountInput, commissionInput] = screen.getAllByRole('spinbutton')
    fireEvent.change(amountInput, { target: { value: '1000' } })
    fireEvent.change(commissionInput, { target: { value: '20' } })

    const received = screen.getByText(/notes received/i).closest('.rounded-xl') as HTMLElement
    fireEvent.click(within(received).getByRole('button', { name: /add Rs 1000/i }))
    fireEvent.click(within(received).getByRole('button', { name: /add Rs 20/i }))

    fireEvent.click(screen.getByRole('button', { name: /confirm|submit|save/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))

    const after = useAppStore.getState().data!
    const tx = after.transactions[0]
    expect(tx.type).toBe('deposit')
    expect(tx.walletDelta).toBe(-1000_00)
    expect(tx.cashDelta).toBe(1020_00)
    expect(tx.commission).toBe(20_00)
    expect(tx.commissionMode).toBe('cash')
    expect(after.wallets.find((w) => w.id === walletId)!.balance).toBe(before - 1000_00)
    expect(after.cashMovements[0].delta).toBe(1020_00)
  })

  it('Easyload hides the commission controls', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^easyload$/i }))
    expect(screen.queryByRole('button', { name: /fee in cash/i })).not.toBeInTheDocument()
  })

  it('Other keeps the manual wallet-direction flow', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^other$/i }))
    expect(screen.getByRole('button', { name: /money out/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /money in/i })).toBeInTheDocument()
  })
})
