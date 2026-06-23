import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import Adjustment from './Adjustment'

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: false, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
  useAppStore.setState({
    data: {
      ...useAppStore.getState().data!,
      drawer: { 1000: 5 }, // Rs 5000
      wallets: [
        { id: 'easypaisa', name: 'Easypaisa', balance: 3000_00 },
        { id: 'jazzcash', name: 'JazzCash', balance: 0 },
        { id: 'bank', name: 'Bank', balance: 0 },
      ],
    },
  })
})

function renderPage() {
  return render(
    <MemoryRouter>
      <Adjustment />
    </MemoryRouter>,
  )
}

describe('Adjustment page', () => {
  it('Confirm is disabled when nothing is entered', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('adds cash to the drawer and records an adjustment movement', async () => {
    renderPage()
    fireEvent.click(screen.getByLabelText('add Rs 1000'))
    fireEvent.click(screen.getByLabelText('add Rs 1000'))
    expect(screen.getByRole('button', { name: /confirm/i })).not.toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => {
      expect(useAppStore.getState().data!.adjustments).toHaveLength(1)
    })
    expect(useAppStore.getState().data!.drawer[1000]).toBe(7)
    expect(useAppStore.getState().data!.cashMovements[0].sourceType).toBe('adjustment')
    expect(useAppStore.getState().data!.cashMovements[0].delta).toBe(2000_00)
  })

  it('"Take money out" direction negates the cash change', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /take money out/i }))
    fireEvent.click(screen.getByLabelText('add Rs 1000'))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => {
      expect(useAppStore.getState().data!.adjustments).toHaveLength(1)
    })
    expect(useAppStore.getState().data!.drawer[1000]).toBe(4) // 5 - 1 = 4
    expect(useAppStore.getState().data!.cashMovements[0].delta).toBe(-1000_00)
  })

  it('Confirm is disabled when removing more from a wallet than it holds', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /take money out/i }))
    fireEvent.change(screen.getByRole('combobox', { name: /wallet/i }), { target: { value: 'easypaisa' } })
    // walletAmount input appears now; Rs 40000 > Easypaisa balance of Rs 3000
    fireEvent.change(screen.getByLabelText(/amount \(rs\)/i), { target: { value: '40000' } })
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('Delete button removes an adjustment and reverses the drawer', async () => {
    // Pre-add via store so history shows without navigating
    await useAppStore.getState().addAdjustment({ cashNotes: { 1000: 2 } }) // drawer: 5+2=7
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    await waitFor(() => {
      expect(useAppStore.getState().data!.adjustments).toHaveLength(0)
    })
    expect(useAppStore.getState().data!.drawer[1000]).toBe(5) // reversed
    expect(useAppStore.getState().data!.cashMovements).toHaveLength(0)
  })
})
