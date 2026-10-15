import { render, screen, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import SearchBar from '@/components/SearchBar';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('SearchBar', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    mockPush.mockClear();
  });

  it('renders search input and button', () => {
    render(<SearchBar />);
    
    const input = screen.getByPlaceholderText(/enter license plate/i);
    const button = screen.getByRole('button', { name: /search/i });
    
    expect(input).toBeInTheDocument();
    expect(button).toBeInTheDocument();
  });

  it('navigates to plate page when valid plate is entered', () => {
    render(<SearchBar />);
    
    const input = screen.getByPlaceholderText(/enter license plate/i);
    const button = screen.getByRole('button', { name: /search/i });
    
    fireEvent.change(input, { target: { value: '7ABC123' } });
    fireEvent.click(button);
    
    expect(mockPush).toHaveBeenCalledWith('/plate/7ABC123');
  });

  it('converts plate to uppercase', () => {
    render(<SearchBar />);
    
    const input = screen.getByPlaceholderText(/enter license plate/i);
    const button = screen.getByRole('button', { name: /search/i });
    
    fireEvent.change(input, { target: { value: 'abc123' } });
    fireEvent.click(button);
    
    expect(mockPush).toHaveBeenCalledWith('/plate/ABC123');
  });

  it('shows inline error when empty plate is submitted', () => {
    render(<SearchBar />);

    const button = screen.getByRole('button', { name: /search/i });
    fireEvent.click(button);

    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a license plate number');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('rejects plates with invalid characters', () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/enter license plate/i);
    fireEvent.change(input, { target: { value: "AB'C;--" } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/letters and numbers/i);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('clears the error once the user types again', () => {
    render(<SearchBar />);

    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/enter license plate/i), { target: { value: 'A' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('strips inner spaces and dashes', () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/enter license plate/i);
    fireEvent.change(input, { target: { value: '7 abc-123' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(mockPush).toHaveBeenCalledWith('/plate/7ABC123');
  });

  it('trims whitespace from plate number', () => {
    render(<SearchBar />);
    
    const input = screen.getByPlaceholderText(/enter license plate/i);
    const button = screen.getByRole('button', { name: /search/i });
    
    fireEvent.change(input, { target: { value: '  ABC123  ' } });
    fireEvent.click(button);
    
    expect(mockPush).toHaveBeenCalledWith('/plate/ABC123');
  });
});

