import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import CountDrawer from './CountDrawer'

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: false, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
  useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 100: 10 } } }) // Rs 1000
})

function renderPage() {
  return render(
    <MemoryRouter>
      <CountDrawer />
    </MemoryRouter>,
  )
}

describe('CountDrawer page', () => {
  it('shows the live difference as notes are counted', () => {
    renderPage()
    fireEvent.click(screen.getByLabelText('add Rs 100')) // counted Rs 100 vs expected Rs 1000
    expect(screen.getByText(/Short/i)).toBeInTheDocument()
  })

  it('requires a reason when the count does not match', async () => {
    renderPage()
    fireEvent.click(screen.getByLabelText('add Rs 100')) // mismatch
    const confirm = screen.getByRole('button', { name: /confirm & reconcile/i })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'miscount' } })
    expect(confirm).not.toBeDisabled()
    fireEvent.click(confirm)
    await waitFor(() => {
      expect(useAppStore.getState().data!.counts).toHaveLength(1)
    })
    expect(useAppStore.getState().data!.counts[0].note).toBe('miscount')
    expect(useAppStore.getState().data!.drawer[100]).toBe(1)
  })

  it('reconciles a matched count without a reason and records a snapshot', async () => {
    renderPage()
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByLabelText('add Rs 100')) // counted Rs 1000 == expected
    expect(screen.getByText(/Matches/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /confirm & reconcile/i }))
    await waitFor(() => {
      expect(useAppStore.getState().data!.counts).toHaveLength(1)
    })
    expect(useAppStore.getState().data!.counts[0].difference).toBe(0)
    expect(useAppStore.getState().data!.cashMovements).toHaveLength(0)
  })
})
