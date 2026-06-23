import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import { useAppStore } from '../store/appStore'
import Settings from './Settings'

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: true, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
  useAppStore.setState({ authed: true })
})

describe('Settings', () => {
  it('updates the shop name', async () => {
    render(<Settings />)
    const input = screen.getByLabelText(/shop name/i)
    await userEvent.clear(input)
    await userEvent.type(input, 'Saleem PCO')
    await userEvent.click(screen.getByRole('button', { name: /save shop/i }))
    expect(useAppStore.getState().data?.settings.shopName).toBe('Saleem PCO')
  })

  it('adds a new wallet', async () => {
    render(<Settings />)
    await userEvent.type(screen.getByLabelText(/new wallet name/i), 'SadaPay')
    await userEvent.click(screen.getByRole('button', { name: /add wallet/i }))
    expect(useAppStore.getState().data?.wallets.map((w) => w.name)).toContain('SadaPay')
  })

  it('adds an expense category', async () => {
    render(<Settings />)
    fireEvent.change(screen.getByLabelText(/new category/i), { target: { value: 'Internet' } })
    fireEvent.click(screen.getByRole('button', { name: /add category/i }))
    await waitFor(() => {
      expect(useAppStore.getState().data!.settings.expenseCategories).toContain('Internet')
    })
  })
})
