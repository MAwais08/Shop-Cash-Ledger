import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DEFAULT_DENOMINATIONS } from '../domain/denominations'
import NotePicker from './NotePicker'

describe('NotePicker', () => {
  it('increments a denomination and reports new counts', async () => {
    const onChange = vi.fn()
    render(
      <NotePicker label="Cash received" denominations={DEFAULT_DENOMINATIONS} counts={{}} onChange={onChange} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /add Rs 5000/i }))
    expect(onChange).toHaveBeenCalledWith({ 5000: 1 })
  })

  it('does not decrement below zero', async () => {
    const onChange = vi.fn()
    const { container } = render(
      <NotePicker label="Cash received" denominations={DEFAULT_DENOMINATIONS} counts={{ 100: 0 }} onChange={onChange} />,
    )
    const buttons = Array.from(container.querySelectorAll('button[aria-label="remove Rs 100"]'))
    await userEvent.click(buttons[0] as HTMLElement)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows the running total', () => {
    render(
      <NotePicker label="Cash received" denominations={DEFAULT_DENOMINATIONS} counts={{ 5000: 2, 100: 1 }} onChange={() => {}} />,
    )
    expect(screen.getByText('Rs 10,100')).toBeInTheDocument()
  })
})
