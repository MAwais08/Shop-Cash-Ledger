import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import NewTransaction from './NewTransaction'

// Mock the router navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

beforeEach(async () => {
  mockNavigate.mockClear()
  useAppStore.setState({ data: null, authed: false, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
})

describe('NewTransaction', () => {
  it('renders form with transaction type selector', () => {
    render(
      <BrowserRouter>
        <NewTransaction />
      </BrowserRouter>,
    )
    expect(screen.getByText(/easyload/i)).toBeInTheDocument()
    expect(screen.getByText(/send/i)).toBeInTheDocument()
  })

  it('renders wallet selector', () => {
    render(
      <BrowserRouter>
        <NewTransaction />
      </BrowserRouter>,
    )
    expect(screen.getByLabelText(/^wallet$/i)).toBeInTheDocument()
  })

  it('renders amount and commission inputs', () => {
    render(
      <BrowserRouter>
        <NewTransaction />
      </BrowserRouter>,
    )
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs.length).toBeGreaterThan(0)
  })

  it('renders NotePicker for notes received', () => {
    render(
      <BrowserRouter>
        <NewTransaction />
      </BrowserRouter>,
    )
    expect(screen.getByText(/notes received/i)).toBeInTheDocument()
  })

  it('renders NotePicker for change given', () => {
    render(
      <BrowserRouter>
        <NewTransaction />
      </BrowserRouter>,
    )
    expect(screen.getByText(/change given/i)).toBeInTheDocument()
  })

  it('records a send/easyload that DEBITS the wallet and credits the drawer, then navigates', async () => {
    const { getByRole } = render(
      <BrowserRouter>
        <NewTransaction />
      </BrowserRouter>,
    )

    // Default type is 'easyload' → wallet direction 'out' (money leaves the float).
    // Select the first real wallet (easypaisa); options[0] is the "No Wallet" entry.
    const walletSelect = screen.getByLabelText(/^wallet$/i) as HTMLSelectElement
    fireEvent.change(walletSelect, { target: { value: walletSelect.options[1].value } })
    const walletId = walletSelect.options[1].value

    // Amount: 5000 rupees → 500000 paisa.
    const amountInput = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(amountInput, { target: { value: '5000' } })

    // Cash received: one Rs 5000 note → +500000 paisa to the drawer.
    const received = screen.getByText('Notes Received').closest('.rounded-xl') as HTMLElement
    fireEvent.click(within(received).getByRole('button', { name: /add Rs 5000/i }))

    fireEvent.click(getByRole('button', { name: /submit|save|confirm/i }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))

    const after = useAppStore.getState().data!
    expect(after.transactions).toHaveLength(1)
    const tx = after.transactions[0]
    expect(tx.amount).toBe(500000)
    // The regression guard: an outgoing easyload must DECREASE the wallet, not increase it.
    expect(tx.walletDelta).toBe(-500000)
    expect(after.wallets.find((w) => w.id === walletId)!.balance).toBe(-500000)
    // Cash received flows to the drawer and is recorded as a matching cash movement.
    expect(tx.cashDelta).toBe(500000)
    expect(after.cashMovements).toHaveLength(1)
    expect(after.cashMovements[0].delta).toBe(500000)
  })

  it('disables submit when amount is zero', () => {
    const { getByRole } = render(
      <BrowserRouter>
        <NewTransaction />
      </BrowserRouter>,
    )
    const submitBtn = getByRole('button', { name: /submit|save|confirm/i })
    expect(submitBtn).toBeDisabled()
  })
})
