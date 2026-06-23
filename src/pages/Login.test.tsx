import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import { useAppStore } from '../store/appStore'
import Login from './Login'

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: false, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
})

describe('Login', () => {
  it('shows an error on wrong PIN and authenticates on correct PIN', async () => {
    render(<Login />)
    const input = screen.getByLabelText(/pin/i)

    await userEvent.type(input, '0000')
    await userEvent.click(screen.getByRole('button', { name: /login/i }))
    expect(screen.getByText(/galat pin/i)).toBeInTheDocument()
    expect(useAppStore.getState().authed).toBe(false)

    await userEvent.clear(input)
    await userEvent.type(input, '1234')
    await userEvent.click(screen.getByRole('button', { name: /login/i }))
    expect(useAppStore.getState().authed).toBe(true)
  })
})
