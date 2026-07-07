"""Dive Centre Manly (divesydney.com.au) — Rezdy monthly calendar widget."""
from common import Event, Window
from sources.rezdy import fetch_rezdy

ID = "divesydney"
NAME = "Dive Centre Manly"
SHORT = "DC Manly"
URL = "https://divesydney.com.au/dive-calendar/"


def fetch(window: Window) -> list[Event]:
    return fetch_rezdy(ID, "https://divecentremanly50.rezdy.com", 494484, window)
